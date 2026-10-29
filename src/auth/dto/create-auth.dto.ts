import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAuthDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail()
    email: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    firstName: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(50)
    lastName: string;

    @IsOptional()
    @Matches(/^\+?[0-9]{7,15}$/, { message: 'phone must be digits (7-15), optional leading +' })
    phone?: string;

    @IsString()
    @MinLength(8)
    @MaxLength(72) // bcrypt only uses the first 72 bytes
    password: string;
}
