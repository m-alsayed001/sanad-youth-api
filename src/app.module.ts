import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppCacheModule } from './common/cache/app-cache.module.js';
import { AppThrottlerGuard } from './common/guards/throttler.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { ProgramsModule } from './programs/programs.module.js';
import { ApplicationsModule } from './applications/applications.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // global rate limit: 100 requests / minute per client (stricter limits on auth routes)
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 100) }]),
    PrismaModule,
    AppCacheModule,
    AuthModule,
    UserModule,
    ProgramsModule,
    ApplicationsModule,
    AnnouncementsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class AppModule {}
