import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppCacheService } from '../common/cache/app-cache.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CreateSessionDto, UpdateSessionDto } from './dto/program.dto.js';
import { ProgramsService } from './programs.service.js';

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
    private readonly cache: AppCacheService,
  ) {}

  async create(programId: number, dto: CreateSessionDto, user: currentUserDto) {
    await this.programs.assertCanManage(programId, user);
    validateSession(dto.startsAt, dto.endsAt, dto.location, dto.meetingUrl);
    const session = await this.prisma.session.create({ data: { ...dto, programId } });
    await this.cache.invalidate(`program:${programId}`); // sessions are part of cached details
    return session;
  }

  async update(programId: number, sessionId: number, dto: UpdateSessionDto, user: currentUserDto) {
    await this.programs.assertCanManage(programId, user);
    const current = await this.findInProgram(programId, sessionId);
    validateSession(
      dto.startsAt ?? current.startsAt,
      dto.endsAt ?? current.endsAt,
      dto.location ?? current.location,
      dto.meetingUrl ?? current.meetingUrl,
    );
    const session = await this.prisma.session.update({ where: { id: sessionId }, data: dto });
    await this.cache.invalidate(`program:${programId}`);
    return session;
  }

  async remove(programId: number, sessionId: number, user: currentUserDto) {
    await this.programs.assertCanManage(programId, user);
    await this.findInProgram(programId, sessionId);
    await this.prisma.session.delete({ where: { id: sessionId } });
    await this.cache.invalidate(`program:${programId}`);
    return { message: 'Session deleted' };
  }

  private async findInProgram(programId: number, sessionId: number) {
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, programId } });
    if (!session) throw new NotFoundException('Session not found in this program');
    return session;
  }
}

function validateSession(
  startsAt: string | Date,
  endsAt: string | Date,
  location?: string | null,
  meetingUrl?: string | null,
) {
  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
  if (!location && !meetingUrl) {
    throw new BadRequestException('A session needs a location or a meetingUrl');
  }
}
