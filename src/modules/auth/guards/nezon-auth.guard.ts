import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import { NezonCommandContext } from '@src/libs/nezon/interfaces/command-context.interface';
import { UserService } from '@src/modules/user/user.service';

@Injectable()
export class NezonAuthGuard implements CanActivate {
  private readonly logger = new Logger(NezonAuthGuard.name);

  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'rpc') {
      return true;
    }

    const nezonContext = context.switchToRpc().getData<NezonCommandContext>();
    const senderId = nezonContext.message.sender_id;

    if (!senderId) {
      this.logger.warn('NezonAuthGuard: No sender_id found in message');
      return false;
    }

    const role = await this.resolveRoleFromClan(nezonContext, senderId);
    const user = await this.userService.findByMezonId(senderId);

    if (!user) {
      this.logger.warn(
        `NezonAuthGuard: User with mezonId ${senderId} not found. Access denied. Use *user create @mention to add users.`,
      );
      return false;
    }

    if (user.role !== role) {
      this.logger.log(
        `NezonAuthGuard: Syncing role for ${senderId} from ${user.role} to ${role}`,
      );
      const updatedUser = await this.userService.upsertByMezonId(senderId, {
        role,
      });
      (nezonContext as any).dbUser = updatedUser;
      return true;
    }

    (nezonContext as any).dbUser = user;
    return true;
  }

  private async resolveRoleFromClan(
    context: NezonCommandContext,
    mezonId: string,
  ): Promise<UserRole> {
    try {
      const clan = await context.getClan();
      if (!clan) {
        return UserRole.UK;
      }

      const rolesData = await (clan as any).listRoles?.();
      const roles =
        rolesData?.roles?.roles ?? rolesData?.roles ?? rolesData ?? [];
      if (!Array.isArray(roles)) {
        return UserRole.UK;
      }

      for (const role of roles) {
        const roleUsers =
          role?.role_user_list?.role_users ?? (role as any)?.role_users ?? [];
        if (!Array.isArray(roleUsers)) {
          continue;
        }

        const isMember = roleUsers.some((member: any) => {
          const userId = String(member?.id || member?.user_id || '').trim();
          return userId === mezonId;
        });

        if (isMember) {
          const roleName = String(
            role?.title ||
              role?.name ||
              role?.rolename ||
              role?.role_label ||
              '',
          ).trim();
          return this.mapMezonRoleToUserRole(roleName);
        }
      }
    } catch (error) {
      this.logger.debug(
        `NezonAuthGuard: Could not resolve clan role for ${mezonId}: ${(error as Error).message}`,
      );
    }

    return UserRole.UK;
  }

  private mapMezonRoleToUserRole(roleName: string): UserRole {
    const normalized = roleName.trim().toUpperCase();

    if (
      normalized.includes('OWNER') ||
      normalized.includes('ADMIN') ||
      normalized.includes('ADMINISTRATOR')
    ) {
      return UserRole.ADMIN;
    }

    if (
      normalized.includes('MANAGER') ||
      normalized.includes('PROJECT') ||
      normalized.includes('PM') ||
      normalized.includes('PR')
    ) {
      return UserRole.PM;
    }

    if (normalized.includes('DEV') || normalized.includes('DEVELOPER')) {
      return UserRole.DEV;
    }

    if (normalized.includes('QA')) {
      return UserRole.QA;
    }

    return UserRole.UK;
  }
}
