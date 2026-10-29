import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { AppCacheService } from './app-cache.service.js';

@Global()
@Module({
  // in-memory store; swap for Redis in production with no code change in services
  imports: [CacheModule.register()],
  providers: [AppCacheService],
  exports: [AppCacheService],
})
export class AppCacheModule {}
