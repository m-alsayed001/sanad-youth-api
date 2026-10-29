import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { paginate } from '../common/dto/pagination.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateSupervisorDto, UpdateMeDto, UserQueryDto } from './dto/user.dto.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createSupervisor(dto: CreateSupervisorDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) {
      throw new ConflictException('Email already exists');
    }
    const password = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({ data: { ...dto, password, role: 'SUPERVISOR' } });
  }

  async findAll(query: UserQueryDto) {
    const { page = 1, limit = 10, role, search } = query;
    const where: Prisma.UserWhereInput = {
      role,
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(users, total, page, limit);
  }

  updateMe(userId: number, dto: UpdateMeDto) {
    return this.prisma.user.update({ where: { id: userId }, data: dto });
  }
}
