import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import type { Cache } from 'cache-manager';

// Cache-aside with "versioned namespaces":
//  - every key carries its namespace version, e.g.  announcements:v3:general:1:10
//  - any write bumps the version, so all older keys are ignored instantly
//  => readers always get the latest data after an edit, without deleting keys one by one.
@Injectable()
export class AppCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private async version(ns: string): Promise<number> {
    return (await this.cache.get<number>(`ver:${ns}`)) ?? 0;
  }

  async getOrSet<T>(ns: string, key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const fullKey = `${ns}:v${await this.version(ns)}:${key}`;
    const hit = await this.cache.get<T>(fullKey);
    if (hit !== undefined && hit !== null) return hit;
    const value = await loader();
    await this.cache.set(fullKey, value, ttlMs);
    return value;
  }

  async invalidate(ns: string) {
    await this.cache.set(`ver:${ns}`, (await this.version(ns)) + 1);
  }
}
