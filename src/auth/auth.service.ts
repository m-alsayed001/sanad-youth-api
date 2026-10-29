import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { LoginDto } from './dto/LoginDto.js';

@Injectable()
export class AuthService {
    constructor(private readonly jwtService: JwtService,
        private readonly prisma: PrismaService) {}

    async login(loginDto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: loginDto.email },
            omit: { password: false }, // the only place where the hash is loaded
        });

        // same message for "no user" and "wrong password" => attacker can't discover which emails exist
        if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
            throw new UnauthorizedException('Invalid email or password');
        }

        const payload = { sub: user.id, email: user.email, role: user.role };
        const { password: _hash, ...safeUser } = user;
        return {
            accessToken: await this.jwtService.signAsync(payload),
            user: safeUser,
        };
    }

    // Public registration always creates a YOUTH. Supervisors are created by the admin only.
    async register(dto: CreateAuthDto) {
        const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
        if (exists) {
            throw new ConflictException('Email already exists');
        }

        const passwordHash = await bcrypt.hash(dto.password, 10);
        const user = await this.prisma.user.create({
            data: { ...dto, password: passwordHash, role: 'YOUTH' },
        });

        return { message: 'User registered successfully', user };
    }

    me(userId: number) {
        return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }
}
