import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { currentUserDto } from '../user/dto/currentUserDto.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {

    constructor(configService: ConfigService) {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
            throw new Error('JWT_SECRET is missing from .env');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: secret
        });
    }

    // whatever is returned here becomes req.user
    async validate(payload: any): Promise<currentUserDto> {
        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}
