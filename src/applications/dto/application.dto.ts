import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ApplicationStatus } from '../../common/Enums/index.js';

export class CreateApplicationDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivation?: string;
}

export class ApplicationQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programId?: number;
}
