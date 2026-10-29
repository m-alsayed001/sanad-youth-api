import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { CreateMaterialDto } from './dto/program.dto.js';
import { ProgramsService } from './programs.service.js';

@Injectable()
export class MaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly programs: ProgramsService,
  ) {}

  async upload(programId: number, dto: CreateMaterialDto, file: Express.Multer.File | undefined, user: currentUserDto) {
    if (!file) throw new BadRequestException('file is required');
    try {
      await this.programs.assertCanManage(programId, user);
      return await this.prisma.material.create({
        data: {
          programId,
          title: dto.title,
          filePath: file.path.replace(/\\/g, '/'),
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
        omit: { filePath: true },
      });
    } catch (e) {
      await unlink(file.path).catch(() => undefined);
      throw e;
    }
  }

  // only staff of the program or ACCEPTED youth can list / download materials
  async list(programId: number, user: currentUserDto) {
    await this.programs.assertIsMember(programId, user);
    return this.prisma.material.findMany({
      where: { programId },
      orderBy: { createdAt: 'desc' },
      omit: { filePath: true }, // never expose server paths
    });
  }

  async getForDownload(programId: number, materialId: number, user: currentUserDto) {
    await this.programs.assertIsMember(programId, user);
    const material = await this.prisma.material.findFirst({ where: { id: materialId, programId } });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async remove(programId: number, materialId: number, user: currentUserDto) {
    await this.programs.assertCanManage(programId, user);
    const material = await this.prisma.material.findFirst({ where: { id: materialId, programId } });
    if (!material) throw new NotFoundException('Material not found');
    await this.prisma.material.delete({ where: { id: materialId } });
    await unlink(material.filePath).catch(() => undefined);
    return { message: 'Material deleted' };
  }
}
