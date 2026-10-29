import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PassportModule } from "@nestjs/passport";
import { JwtModule } from "@nestjs/jwt";

import { PrismaModule } from "../prisma/prisma.module.js";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { StringValue } from 'ms';
import { JwtStrategy } from "./jwt.strategy.js";

@Module({
imports: [
    PrismaModule,
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({        
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
            const secret = configService.get<string>('JWT_SECRET');
            if (!secret) {
                throw new Error('JWT_SECRET is missing from .env');
            }
            const expiresIn =
            configService.get<string>('JWT_EXPIRES_IN') ?? '1h';
            return {
                secret,signOptions: {expiresIn: expiresIn as StringValue}
            };
        }
    }
)
],
controllers: [AuthController],
providers: [AuthService, JwtStrategy]
})
export class AuthModule {}