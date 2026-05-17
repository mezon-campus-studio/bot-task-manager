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

    const roleFromClan = await this.resolveRoleFromClan(nezonContext, senderId);
    const user = await this.userService.findByMezonId(senderId, true);

    const rawText = String((nezonContext.message as any)?.content?.t ?? '');
    const isUserCreateCommand = /^\s*\*user\s+create\b/i.test(rawText);

    const effectiveRole = user ? user.role : roleFromClan;

    let isAuthorizedForCreate = false;
    if (user) {
      isAuthorizedForCreate =
        effectiveRole === UserRole.ADMIN || effectiveRole === UserRole.PM;
    } else {
      isAuthorizedForCreate = roleFromClan === UserRole.ADMIN;
    }

    if (!user) {
      if (isUserCreateCommand && isAuthorizedForCreate) {
        this.logger.log(
          `NezonAuthGuard: Bypassing missing-user check for *user create (mezonId=${senderId}, resolvedRole=${roleFromClan}). Creating bootstrap admin user in DB.`,
        );

        const adminName =
          nezonContext.message?.display_name ||
          nezonContext.message?.username ||
          `Admin_${senderId.slice(-8)}`;

        const createdUser = await this.userService.upsertByMezonId(senderId, {
          role: roleFromClan as UserRole,
          name: adminName,
        });

        (nezonContext as any).dbUser = createdUser;
        (nezonContext as any).isNewBootstrap = true;
        return true;
      }

      this.logger.warn(
        `NezonAuthGuard: User with mezonId ${senderId} not found or unauthorized (ClanRole=${roleFromClan}). Access denied.`,
      );
      return false;
    }

    if (user.deletedAt != null) {
      if (isUserCreateCommand && isAuthorizedForCreate) {
        this.logger.log(
          `NezonAuthGuard: Recovering soft-deleted user for *user create (mezonId=${senderId}, role=${effectiveRole}).`,
        );

        const adminName =
          nezonContext.message?.display_name ||
          nezonContext.message?.username ||
          `Admin_${senderId.slice(-8)}`;

        const recoveredUser = await this.userService.upsertByMezonId(senderId, {
          role: effectiveRole as UserRole,
          name: adminName,
        });

        (nezonContext as any).dbUser = recoveredUser;
        return true;
      }

      this.logger.warn(
        `NezonAuthGuard: Denying access for soft-deleted user mezonId ${senderId}`,
      );
      return false;
    }

    if (isUserCreateCommand && !isAuthorizedForCreate) {
      this.logger.warn(
        `NezonAuthGuard: Non-authorized mezonId ${senderId} (Role=${effectiveRole}) attempted to execute *user create. Denied.`,
      );
      return false;
    }

    if (
      roleFromClan != null &&
      shouldSyncResolvedUserRole(user.role, roleFromClan)
    ) {
      this.logger.log(
        `NezonAuthGuard: Syncing role for ${senderId} from ${user.role} to ${roleFromClan}`,
      );

      const updatedUser = await this.userService.upsertByMezonId(senderId, {
        role: roleFromClan,
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
