import { OmitType, PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CreateAuthDto } from '../../auth/dto/create-auth.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { UserRole } from '../../common/Enums/index.js';

// admin creates a supervisor with the same fields as a normal registration
export class CreateSupervisorDto extends CreateAuthDto {}

// a user can only edit name / phone (not email, not role)
export class UpdateMeDto extends PartialType(OmitType(CreateAuthDto, ['email', 'password'] as const)) {}

export class UserQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  search?: string;
}
