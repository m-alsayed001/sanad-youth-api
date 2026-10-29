import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ProgramStatus } from '../../common/Enums/index.js';

export class CreateProgramDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;

  @IsString()
  @MinLength(10)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  capacity: number;

  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  // required only when an ADMIN creates the program (supervisors create for themselves)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supervisorId?: number;
}

export class UpdateProgramDto extends PartialType(OmitType(CreateProgramDto, ['supervisorId'] as const)) {}

export class ProgramQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;
}

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUrl()
  meetingUrl?: string;
}

export class UpdateSessionDto extends PartialType(CreateSessionDto) {}

export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title: string;
}
