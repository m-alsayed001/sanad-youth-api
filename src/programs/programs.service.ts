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
import { UserRole } from '../common/Enums/index.js';
import { Prisma } from '../generated/prisma/client.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CreateProgramDto, ProgramQueryDto, UpdateProgramDto } from './dto/program.dto.js';

const supervisorPublic = { select: { id: true, firstName: true, lastName: true } };

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AppCacheService,
  ) {}

  // ---------- reads ----------

  async findAll(query: ProgramQueryDto, user: currentUserDto) {
    const { page = 1, limit = 10, search, status } = query;
    const where: Prisma.ProgramWhereInput = {
      // youth only browse open programs; staff can filter by any status
      status: user.role === UserRole.YOUTH ? 'ACTIVE' : status,
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [programs, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { supervisor: supervisorPublic },
      }),
      this.prisma.program.count({ where }),
    ]);
    return paginate(programs.map(withImageUrl), total, page, limit);
  }

  async findMine(user: currentUserDto, query: ProgramQueryDto) {
    const { page = 1, limit = 10 } = query;
    const where = { supervisorId: user.userId };
    const [programs, total] = await this.prisma.$transaction([
      this.prisma.program.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { applications: true } } },
      }),
      this.prisma.program.count({ where }),
    ]);
    return paginate(programs.map(withImageUrl), total, page, limit);
  }

  // Details are read a lot and edited rarely => cached.
  // availableSeats changes on every application, so it is NOT cached: we read it fresh and merge it in.
  async findOne(id: number) {
    const details = await this.cache.getOrSet(`program:${id}`, 'details', 5 * 60_000, () =>
      this.prisma.program.findUnique({
        where: { id },
        omit: { availableSeats: true },
        include: {
          supervisor: supervisorPublic,
          sessions: { orderBy: { startsAt: 'asc' } },
        },
      }),
    );
    if (!details) throw new NotFoundException('Program not found');

    const { availableSeats } = await this.prisma.program.findUniqueOrThrow({
      where: { id },
      select: { availableSeats: true },
    });
    return withImageUrl({ ...details, availableSeats });
  }

  // ---------- writes ----------

  async create(dto: CreateProgramDto, user: currentUserDto) {
    let supervisorId: number;
    if (user.role === UserRole.ADMIN) {
      if (!dto.supervisorId) throw new BadRequestException('Admin must provide supervisorId');
      const supervisor = await this.prisma.user.findUnique({ where: { id: dto.supervisorId } });
      if (!supervisor || supervisor.role !== UserRole.SUPERVISOR) {
        throw new BadRequestException('supervisorId must belong to a supervisor');
      }
      supervisorId = dto.supervisorId;
    } else {
      if (dto.supervisorId && dto.supervisorId !== user.userId) {
        throw new ForbiddenException('A supervisor cannot create programs for another supervisor');
      }
      supervisorId = user.userId;
    }

    const { supervisorId: _ignored, ...data } = dto;
    return this.prisma.program.create({
      data: { ...data, supervisorId, availableSeats: dto.capacity },
    });
  }

  async update(id: number, dto: UpdateProgramDto, user: currentUserDto) {
    await this.assertCanManage(id, user);
    const { capacity, ...rest } = dto;

    const program = await this.prisma.$transaction(async (tx) => {
      if (capacity !== undefined) {
        // Atomic: new capacity can't go below seats already taken (capacity - availableSeats).
        const changed = await tx.$executeRaw`
          UPDATE "Program"
          SET "availableSeats" = "availableSeats" + (${capacity} - "capacity"), "capacity" = ${capacity}
          WHERE "id" = ${id} AND ("capacity" - "availableSeats") <= ${capacity}`;
        if (changed === 0) {
          throw new ConflictException('Capacity cannot be lower than the number of seats already taken');
        }
      }
      return tx.program.update({ where: { id }, data: rest });
    });

    await this.cache.invalidate(`program:${id}`);
    return withImageUrl(program);
  }

  async remove(id: number, user: currentUserDto) {
    await this.assertCanManage(id, user);
    const active = await this.prisma.application.count({
      where: { programId: id, status: { in: ['PENDING', 'ACCEPTED'] } },
    });
    if (active > 0) {
      throw new ConflictException('Program has active applications; set its status to CLOSED instead');
    }
    await this.prisma.program.delete({ where: { id } });
    await this.cache.invalidate(`program:${id}`);
    return { message: 'Program deleted' };
  }

  async setImage(id: number, file: Express.Multer.File | undefined, user: currentUserDto) {
    if (!file) throw new BadRequestException('image file is required');
    try {
      const old = await this.assertCanManage(id, user);
      const program = await this.prisma.program.update({
        where: { id },
        data: { imagePath: file.path.replace(/\\/g, '/') },
      });
      if (old.imagePath) await unlink(old.imagePath).catch(() => undefined);
      await this.cache.invalidate(`program:${id}`);
      return withImageUrl(program);
    } catch (e) {
      await unlink(file.path).catch(() => undefined); // don't keep orphan files
      throw e;
    }
  }

  // ---------- authorization helpers (used by other modules too) ----------

  // ADMIN: any program. SUPERVISOR: only programs he supervises.
  async assertCanManage(programId: number, user: currentUserDto) {
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');
    if (user.role === UserRole.ADMIN) return program;
    if (user.role === UserRole.SUPERVISOR && program.supervisorId === user.userId) return program;
    throw new ForbiddenException('You can only manage your own programs');
  }

  // staff who manage the program, or a youth ACCEPTED in it
  async assertIsMember(programId: number, user: currentUserDto) {
    if (user.role !== UserRole.YOUTH) return this.assertCanManage(programId, user);
    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException('Program not found');
    const app = await this.prisma.application.findUnique({
      where: { youthId_programId: { youthId: user.userId, programId } },
      select: { status: true },
    });
    if (app?.status !== 'ACCEPTED') {
      throw new ForbiddenException('Only youth accepted in this program can access this');
    }
    return program;
  }
}

function withImageUrl<T extends { imagePath?: string | null }>(p: T) {
  return { ...p, imageUrl: p.imagePath ? `/${p.imagePath}` : null };
}
