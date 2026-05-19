import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@src/common/enums/user.enum';
import { ROLES_KEY } from '@src/common/guards/role.guard';
import { NezonCommandContext } from '@src/libs/nezon/interfaces/command-context.interface';

@Injectable()
export class NezonRolesGuard implements CanActivate {
  private readonly logger = new Logger(NezonRolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (context.getType() !== 'rpc') {
      return true;
    }

    const nezonContext = context.switchToRpc().getData<NezonCommandContext>();
    const user = (nezonContext as any).dbUser;

    if (!user) {
      this.logger.warn(
        'NezonRolesGuard: No dbUser found in context. Ensure NezonAuthGuard is used before NezonRolesGuard.',
      );
      return false;
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      this.logger.warn(
        `NezonRolesGuard: User ${user.mezonId} with role ${user.role} does not have required roles: ${requiredRoles.join(', ')}`,
      );
      return false;
    }

    return true;
  }
}
