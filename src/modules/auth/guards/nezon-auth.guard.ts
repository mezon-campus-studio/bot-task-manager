import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import { NezonCommandContext } from '@src/libs/nezon/interfaces/command-context.interface';
import {
  resolveBestMezonRoleForUser,
  shouldSyncResolvedUserRole,
} from '@src/modules/user/user-role.utils';
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
    const user = await this.userService.findByMezonId(senderId, true);

    const rawText = String((nezonContext.message as any)?.content?.t ?? '');
    const isUserCreateCommand = /\*user\s+create\b/i.test(rawText);

    const isAdminAllowed = role === UserRole.ADMIN;

    if (!user) {
      if (isUserCreateCommand && isAdminAllowed) {
        this.logger.log(
          `NezonAuthGuard: Bypassing missing-user check for *user create (mezonId=${senderId}, resolvedRole=${role}). Creating user in DB.`,
        );

        const createdUser = await this.userService.upsertByMezonId(senderId, {
          role,
        });
        (nezonContext as any).dbUser = createdUser;
        return true;
      }

      this.logger.warn(
        `NezonAuthGuard: User with mezonId ${senderId} not found. Access denied. Use *user create @mention to add users.`,
      );
      return false;
    }

    if (user.deletedAt != null) {
      const isAdminAllowed = Number(user.role) === UserRole.ADMIN;

      if (isUserCreateCommand && isAdminAllowed) {
        this.logger.log(
          `NezonAuthGuard: Recovering soft-deleted user for *user create (mezonId=${senderId}, resolvedRole=${role}).`,
        );

        const recoveredUser = await this.userService.upsertByMezonId(senderId, {
          role: role as UserRole,
        });
        (nezonContext as any).dbUser = recoveredUser;
        return true;
      }

      this.logger.warn(
        `NezonAuthGuard: Denying access for soft-deleted user mezonId ${senderId}`,
      );
      return false;
    }

    if (role != null && shouldSyncResolvedUserRole(user.role, role)) {
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
  ): Promise<UserRole | null> {
    try {
      const clan = await context.getClan();
      if (!clan) {
        return null;
      }

      const rolesData = await (clan as any).listRoles?.();
      const roles =
        rolesData?.roles?.roles ?? rolesData?.roles ?? rolesData ?? [];

      if (!Array.isArray(roles)) {
        return null;
      }

      return resolveBestMezonRoleForUser(roles, mezonId);
    } catch (error) {
      this.logger.debug(
        `NezonAuthGuard: Could not resolve clan role for ${mezonId}: ${(error as Error).message}`,
      );
    }

    return null;
  }
}
