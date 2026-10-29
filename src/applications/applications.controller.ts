import {
  Body,
  Controller,
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
import { ApplicationsService } from './applications.service.js';
import { ApplicationQueryDto, CreateApplicationDto } from './dto/application.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  // multipart/form-data: optional "cv" (PDF) + optional "motivation"
  @Post('programs/:id/applications')
  @Roles(UserRole.YOUTH)
  @UseInterceptors(FileInterceptor('cv', uploadOptions('cvs')))
  apply(
    @Param('id', ParseIntPipe) programId: number,
    @Body() dto: CreateApplicationDto,
    @UploadedFile() cv: Express.Multer.File | undefined,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.applications.apply(programId, dto, cv, user);
  }

  @Get('programs/:id/applications')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  findForProgram(
    @Param('id', ParseIntPipe) programId: number,
    @Query() query: ApplicationQueryDto,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.applications.findForProgram(programId, user, query);
  }

  @Get('applications/me')
  @Roles(UserRole.YOUTH)
  findMine(@Query() query: ApplicationQueryDto, @CurrentUser() user: currentUserDto) {
    return this.applications.findMine(user, query);
  }

  @Get('applications')
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: ApplicationQueryDto) {
    return this.applications.findAll(query);
  }

  @Get('applications/:id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.applications.findOne(id, user);
  }

  @Get('applications/:id/cv')
  async downloadCv(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto, @Res() res: Response) {
    const path = await this.applications.getCvPath(id, user);
    res.download(resolve(path), `cv-application-${id}.pdf`);
  }

  @Patch('applications/:id/cancel')
  @Roles(UserRole.YOUTH)
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.applications.cancel(id, user);
  }

  @Patch('applications/:id/accept')
  @Roles(UserRole.ADMIN)
  accept(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.applications.accept(id, user);
  }

  @Patch('applications/:id/reject')
  @Roles(UserRole.ADMIN)
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.applications.reject(id, user);
  }
}
