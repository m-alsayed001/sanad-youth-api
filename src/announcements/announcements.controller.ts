import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { PaginationDto } from '../common/dto/pagination.dto.js';
import { UserRole } from '../common/Enums/index.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';
import { AnnouncementsService } from './announcements.service.js';
import { CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/announcement.dto.js';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post('announcements')
  @Roles(UserRole.ADMIN)
  createGeneral(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: currentUserDto) {
    return this.announcements.createGeneral(dto, user);
  }

  @Post('programs/:id/announcements')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  createForProgram(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: currentUserDto,
  ) {
    return this.announcements.createForProgram(id, dto, user);
  }

  @Get('announcements')
  feed(@Query() query: PaginationDto, @CurrentUser() user: currentUserDto) {
    return this.announcements.feed(user, query);
  }

  @Get('programs/:id/announcements')
  forProgram(@Param('id', ParseIntPipe) id: number, @Query() query: PaginationDto, @CurrentUser() user: currentUserDto) {
    return this.announcements.forProgram(id, user, query);
  }

  @Patch('announcements/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAnnouncementDto, @CurrentUser() user: currentUserDto) {
    return this.announcements.update(id, dto, user);
  }

  @Delete('announcements/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERVISOR)
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: currentUserDto) {
    return this.announcements.remove(id, user);
  }
}
