import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// The default throttler counts requests per IP. On login we count per IP + email,
// so brute-forcing one account gets blocked fast without blocking other users on the same IP.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ips?.length ? req.ips[0] : req.ip;
    const email = req.body?.email;
    return email ? `${ip}:${String(email).toLowerCase()}` : ip;
  }
}
