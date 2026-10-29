import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppCacheService } from '../common/cache/app-cache.service.js';
import { paginate, PaginationDto } from '../common/dto/pagination.dto.js';
import { UserRole } from '../common/Enums/index.js';
import { Prisma } from '../generated/prisma/client.js';
import { ProgramsService } from '../programs/programs.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto.js';

const NS = 'announcements';
const TTL = 2 * 60_000;
const include = {
  author: { select: { id: true, firstName: true, lastName: true, role: true } },
  program: { select: { id: true, title: true } },
};

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
    private readonly cache: AppCacheService,
  ) {}

  async createGeneral(dto: CreateAnnouncementDto, user: currentUserDto) {
    const a = await this.prisma.announcement.create({
      data: { ...dto, scope: 'GENERAL', authorId: user.userId },
      include,
    });
    await this.cache.invalidate(NS);
    return a;
  }

  async createForProgram(programId: number, dto: CreateAnnouncementDto, user: currentUserDto) {
    await this.programs.assertCanManage(programId, user);
    const a = await this.prisma.announcement.create({
      data: { ...dto, scope: 'PROGRAM', programId, authorId: user.userId },
      include,
    });
    await this.cache.invalidate(NS);
    return a;
  }

  // Feed = general announcements + announcements of programs the user belongs to.
  // Read very often, written rarely => cached per user+page; any write bumps the namespace version.
  feed(user: currentUserDto, query: PaginationDto) {
    const { page = 1, limit = 10 } = query;
    return this.cache.getOrSet(NS, `feed:${user.userId}:${page}:${limit}`, TTL, async () => {
      const where = await this.feedWhere(user);
      return this.page(where, page, limit);
    });
  }

  async forProgram(programId: number, user: currentUserDto, query: PaginationDto) {
    await this.programs.assertIsMember(programId, user);
    const { page = 1, limit = 10 } = query;
    return this.cache.getOrSet(NS, `program:${programId}:${page}:${limit}`, TTL, () =>
      this.page({ programId }, page, limit),
    );
  }

  async update(id: number, dto: UpdateAnnouncementDto, user: currentUserDto) {
    await this.assertCanEdit(id, user);
    const a = await this.prisma.announcement.update({ where: { id }, data: dto, include });
    await this.cache.invalidate(NS); // => next read returns the new version
    return a;
  }

  async remove(id: number, user: currentUserDto) {
    await this.assertCanEdit(id, user);
    await this.prisma.announcement.delete({ where: { id } });
    await this.cache.invalidate(NS);
    return { message: 'Announcement deleted' };
  }

  // ---------- helpers ----------

  private async feedWhere(user: currentUserDto): Promise<Prisma.AnnouncementWhereInput> {
    if (user.role === UserRole.ADMIN) return {};
    const programIds =
      user.role === UserRole.SUPERVISOR
        ? (await this.prisma.program.findMany({ where: { supervisorId: user.userId }, select: { id: true } })).map((p) => p.id)
        : (
            await this.prisma.application.findMany({
              where: { youthId: user.userId, status: 'ACCEPTED' },
              select: { programId: true },
            })
          ).map((a) => a.programId);
    return { OR: [{ scope: 'GENERAL' }, { programId: { in: programIds } }] };
  }

  private async page(where: Prisma.AnnouncementWhereInput, page: number, limit: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.announcement.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  // admin edits anything; a supervisor only his own announcements
  private async assertCanEdit(id: number, user: currentUserDto) {
    const a = await this.prisma.announcement.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Announcement not found');
    if (user.role !== UserRole.ADMIN && a.authorId !== user.userId) {
      throw new ForbiddenException('You can only edit your own announcements');
    }
    return a;
  }
}
