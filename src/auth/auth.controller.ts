import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { CreateAuthDto } from './dto/create-auth.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/index.js';
import { LoginDto } from './dto/LoginDto.js';
import { currentUserDto } from '../user/dto/currentUserDto.js';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService: AuthService) {}

    // anti brute-force: 5 attempts / minute for the same email from the same IP
    @Throttle({ default: { limit: 5, ttl: 60_000 } })
    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() body: LoginDto) {
        return this.authService.login(body);
    }

    // anti spam accounts: 10 registrations / minute per IP
    @Throttle({ default: { limit: 10, ttl: 60_000 } })
    @Post('register')
    register(@Body() body: CreateAuthDto) {
        return this.authService.register(body);
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(@CurrentUser() user: currentUserDto) {
        return this.authService.me(user.userId);
    }
}
