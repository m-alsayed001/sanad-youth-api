import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { UserRole } from '../Enums/index.js';

// Authorization step 1: by role.
// Step 2 (ownership: "is this MY program / MY application?") is checked inside the services.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(), // الـ method
      context.getClass(), // الـ controller
    ]);
    if (!roles) return true;
    const user = context.switchToHttp().getRequest().user;
    return roles.includes(user?.role);
  }
}
