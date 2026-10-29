import { Controller, Get, Post, Body, Patch, UseGuards, Query } from '@nestjs/common';
import { UserService } from './user.service.js';
import { UserRole } from '../common/Enums/index.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CurrentUser } from '../common/decorators/index.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { currentUserDto } from './dto/currentUserDto.js';
import { CreateSupervisorDto, UpdateMeDto, UserQueryDto } from './dto/user.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('supervisors')
  @Roles(UserRole.ADMIN)
  createSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.userService.createSupervisor(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@Query() query: UserQueryDto) {
    return this.userService.findAll(query);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: currentUserDto, @Body() dto: UpdateMeDto) {
    return this.userService.updateMe(user.userId, dto);
  }
}
