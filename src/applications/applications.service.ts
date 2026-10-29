import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppCacheService } from '../common/cache/app-cache.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import { ApplicationStatus, UserRole } from '../common/Enums/index.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProgramsService } from '../programs/programs.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { ApplicationQueryDto, CreateApplicationDto } from './dto/application.dto.js';

const programSummary = {
  select: {
    id: true,
    title: true,
    status: true,
    supervisor: { select: { id: true, firstName: true, lastName: true } },
  },
};
const youthSummary = { select: { id: true, firstName: true, lastName: true, email: true, phone: true } };

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
    private readonly cache: AppCacheService,
  ) {}

  /**
   * THE LAST SEAT PROBLEM
   * 100 youth click "apply" on the last seat at the same moment.
   * A naive "read seats -> if > 0 -> create" lets many of them read 1 and all get in (race condition).
   *
   * Fix: one atomic conditional UPDATE inside a transaction:
   *   UPDATE Program SET availableSeats = availableSeats - 1 WHERE id = ? AND availableSeats > 0
   * Postgres locks the row; the others wait, then re-check `availableSeats > 0` and update 0 rows.
   * Exactly one request gets count = 1 -> 201. All others get count = 0 -> 409 "No seats left".
   * If creating the application fails (e.g. duplicate), the transaction rolls back the seat too.
   */
  async apply(programId: number, dto: CreateApplicationDto, cv: Express.Multer.File | undefined, user: currentUserDto) {
    try {
      // friendly early message; the @@unique([youthId, programId]) is the real guarantee
      const existing = await this.prisma.application.findUnique({
        where: { youthId_programId: { youthId: user.userId, programId } },
        select: { id: true },
      });
      if (existing) throw new ConflictException('You already applied to this program');

      return await this.prisma.$transaction(async (tx) => {
        // returns the number of updated rows: 1 = seat reserved, 0 = no seat (or closed / not found)
        const reserved = await tx.$executeRaw`
          UPDATE "Program" SET "availableSeats" = "availableSeats" - 1
          WHERE "id" = ${programId} AND "status" = 'ACTIVE' AND "availableSeats" > 0`;

        if (reserved === 0) {
          const program = await tx.program.findUnique({ where: { id: programId }, select: { status: true } });
          if (!program) throw new NotFoundException('Program not found');
          if (program.status !== 'ACTIVE') throw new BadRequestException('This program is closed for applications');
          throw new ConflictException('No seats left in this program');
        }

        return tx.application.create({
          data: {
            youthId: user.userId,
            programId,
            motivation: dto.motivation,
            cvPath: cv ? cv.path.replace(/\\/g, '/') : null,
          },
          omit: { cvPath: true },
          include: { program: programSummary },
        });
      });
    } catch (e) {
      if (cv) await unlink(cv.path).catch(() => undefined); // failed => don't keep the uploaded CV
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('You already applied to this program');
      }
      throw e;
    }
  }

  async findMine(user: currentUserDto, query: ApplicationQueryDto) {
    return this.list({ youthId: user.userId, status: query.status, programId: query.programId }, query);
  }

  // admin: every application (filter by status / program)
  async findAll(query: ApplicationQueryDto) {
    return this.list({ status: query.status, programId: query.programId }, query);
  }

  // supervisor: applications of one of HIS programs
  async findForProgram(programId: number, user: currentUserDto, query: ApplicationQueryDto) {
    await this.programs.assertCanManage(programId, user);
    return this.list({ programId, status: query.status }, query);
  }

  async findOne(id: number, user: currentUserDto) {
    const app = await this.findVisible(id, user);
    const { cvPath, ...rest } = app;
    return { ...rest, hasCv: !!cvPath };
  }

  async getCvPath(id: number, user: currentUserDto) {
    const app = await this.findVisible(id, user);
    if (!app.cvPath) throw new NotFoundException('This application has no CV');
    return app.cvPath;
  }

  // ---------- status changes ----------

  cancel(id: number, user: currentUserDto) {
    return this.changeStatus(id, ['PENDING', 'ACCEPTED'], 'CANCELLED', user, { ownerOnly: true });
  }

  accept(id: number, user: currentUserDto) {
    return this.changeStatus(id, ['PENDING'], 'ACCEPTED', user);
  }

  reject(id: number, user: currentUserDto) {
    return this.changeStatus(id, ['PENDING'], 'REJECTED', user);
  }

  /**
   * Status machine:  PENDING -> ACCEPTED | REJECTED | CANCELLED,   ACCEPTED -> CANCELLED
   * REJECTED / CANCELLED give the seat back. Done in a transaction with a conditional update
   * (WHERE status IN allowedFrom) so a double click / two admins can never free the same seat twice.
   */
  private async changeStatus(
    id: number,
    allowedFrom: ApplicationStatus[],
    to: ApplicationStatus,
    user: currentUserDto,
    opts: { ownerOnly?: boolean } = {},
  ) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (opts.ownerOnly && app.youthId !== user.userId) {
      throw new ForbiddenException('You can only cancel your own applications');
    }

    const releasesSeat = to === 'REJECTED' || to === 'CANCELLED';
    const isReview = to === 'ACCEPTED' || to === 'REJECTED';

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.application.updateMany({
        where: { id, status: { in: allowedFrom } },
        data: {
          status: to,
          ...(isReview && { reviewedById: user.userId, reviewedAt: new Date() }),
        },
      });
      if (changed.count === 0) {
        throw new ConflictException(`Cannot change status from ${app.status} to ${to}`);
      }
      if (releasesSeat) {
        await tx.program.update({
          where: { id: app.programId },
          data: { availableSeats: { increment: 1 } },
        });
      }
      return tx.application.findUniqueOrThrow({
        where: { id },
        omit: { cvPath: true },
        include: { program: programSummary },
      });
    });

    // accepted youth now see (or stop seeing) the program's private announcements
    await this.cache.invalidate('announcements');
    return updated;
  }

  // ---------- helpers ----------

  private async list(where: Prisma.ApplicationWhereInput, query: ApplicationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        omit: { cvPath: true },
        include: { program: programSummary, youth: youthSummary },
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  // youth: own application only | supervisor: applications of his programs | admin: all
  private async findVisible(id: number, user: currentUserDto) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { program: programSummary, youth: youthSummary },
    });
    if (!app) throw new NotFoundException('Application not found');
    const allowed =
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.YOUTH && app.youthId === user.userId) ||
      (user.role === UserRole.SUPERVISOR && app.program.supervisor.id === user.userId);
    // 404 instead of 403 so nobody can probe which application ids exist
    if (!allowed) throw new NotFoundException('Application not found');
    return app;
  }
}
