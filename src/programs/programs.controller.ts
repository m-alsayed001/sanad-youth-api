import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { resolve } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { UserRole } from '../common/Enums/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { uploadOptions } from '../common/upload/upload.options.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import {
  CreateMaterialDto,
  CreateProgramDto,
  CreateSessionDto,
  ProgramQueryDto,
  UpdateProgramDto,
  UpdateSessionDto,
} from './dto/program.dto.js';
import { MaterialsService } from './materials.service.js';
import { ProgramsService } from './programs.service.js';
import { SessionsService } from './sessions.service.js';

@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgramsController {
  constructor(
    private readonly programs: ProgramsService,
    private readonly sessions: SessionsService,
    private readonly materials: MaterialsService,
  ) {}

  // ----- programs -----

  @Get()
  findAll(@Query() query: ProgramQueryDto, @CurrentUser() user: currentUserDto) {
    return this.programs.findAll(query, user);
  }

  @Get('mine')
  @Roles(UserRole.SUPERVISOR)
  findMine(@Query() query: ProgramQueryDto, @CurrentUser() user: currentUserDto) {
    return this.programs.findMine(user, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.programs.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  create(@Body() dto: CreateProgramDto, @CurrentUser() user: currentUserDto) {
    return this.programs.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProgramDto, @CurrentUser() user: currentUserDto) {
    return this.programs.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.programs.remove(id, user);
  }

  @Post(':id/image')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('image', uploadOptions('images')))
  setImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.programs.setImage(id, file, user);
  }

  // ----- sessions -----

  @Post(':id/sessions')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  addSession(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateSessionDto, @CurrentUser() user: currentUserDto) {
    return this.sessions.create(id, dto, user);
  }

  @Patch(':id/sessions/:sessionId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  updateSession(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.sessions.update(id, sessionId, dto, user);
  }

  @Delete(':id/sessions/:sessionId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  removeSession(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.sessions.remove(id, sessionId, user);
  }

  // ----- materials -----

  @Post(':id/materials')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  @UseInterceptors(FileInterceptor('file', uploadOptions('materials')))
  uploadMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMaterialDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.materials.upload(id, dto, file, user);
  }

  @Get(':id/materials')
  listMaterials(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.materials.list(id, user);
  }

  @Get(':id/materials/:materialId/download')
  async downloadMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Param('materialId', ParseIntPipe) materialId: number,
    @CurrentUser() user: currentUserDto,
    @Res() res: Response,
  ) {
    const material = await this.materials.getForDownload(id, materialId, user);
    res.download(resolve(material.filePath), material.originalName);
  }

  @Delete(':id/materials/:materialId')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  removeMaterial(
    @Param('id', ParseIntPipe) id: number,
    @Param('materialId', ParseIntPipe) materialId: number,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.materials.remove(id, materialId, user);
  }
}
