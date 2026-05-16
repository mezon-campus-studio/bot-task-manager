import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  Args,
  AutoContext,
  Command,
  Context,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonCommandContext } from '@src/libs/nezon/interfaces/command-context.interface';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { UserStatus } from './enum/user-status.enum';
import {
  mapMezonRoleToUserRole,
  resolveBestMezonRoleForUser,
  shouldSyncResolvedUserRole,
} from './user-role.utils';
import UserEntity from './user.entity';
import { UserService } from './user.service';

/**
 * User command handler for the Mezon bot.
 *
 * Supported commands (prefix: *):
 *   *user me               – Show your own profile (name, role, current project)
 *   *user search <userId>  – Search for a user by mezonId or internal UUID
 *   *user info <userId>    – Look up a user by mezonId or internal UUID (ADMIN/PM only)
 *   *user create @username – Create user from clan member (pulls role from clan)
 */
@Injectable()
@UseGuards(NezonAuthGuard)
export class UserCommandHandler {
  private readonly logger = new Logger(UserCommandHandler.name);

  constructor(private readonly userService: UserService) {}

  @Command('user')
  async handleUserCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
    @Context() ctx: NezonCommandContext,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();
    const senderId = message.senderId;

    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    try {
      switch (action) {
        case 'me':
          await this.showMe(ctx, message);
          return;
        case 'info':
          await this.showUserInfo(args, message, ctx);
          return;
        case 'search':
          await this.searchUser(args, message, ctx);
          return;
        case 'create':
          await this.createUserFromMention(message, ctx);
          return;
        case 'list':
          await this.listUsers(message);
          return;
        case 'delete':
          await this.deleteUser(args, message, ctx);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteUser(args, message, ctx);
            return;
          }
          await this.reply(
            message,
            'Usage: `*user confirm delete <mezonId|userId|@username>`',
          );
          return;
        default:
          await this.reply(
            message,
            [
              '👤 **User Commands:**',
              '  `*user me` – View your own profile',
              '  `*user list` – List all users',
              '  `*user search <mezonId|userId>` – Search for a user',
              '  `*user info <mezonId|userId>` – Look up another user (admin/PM only)',
              '  `*user create @username` – Create user from clan member',
              '  `*user delete <mezonId|userId|@username>` – Prepare delete confirmation',
              '  `*user confirm delete <mezonId|userId|@username>` – Confirm user deletion',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('User command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── actions ────────────────────────────────────────────────────────────────

  /**
   * Show the current sender's profile using the dbUser attached by NezonAuthGuard.
   */
  private async showMe(
    ctx: NezonCommandContext,
    message: ManagedMessage,
  ): Promise<void> {
    const user = (ctx as any).dbUser;

    if (!user) {
      await this.reply(
        message,
        '❌ Your account was not found. Please sign in at least once via the web portal.',
      );
      return;
    }

    await this.reply(
      message,
      [
        `👤 **Your Profile:**`,
        `  Name: ${user.name ?? '—'}`,
        `  Email: ${user.email ?? '—'}`,
        `  Role: ${this.getRoleLabel(user.role ?? UserRole.UK)}`,
        `  Status: ${user.status ?? '—'}`,
        `  Current Project ID: ${user.currentProjectId ?? 'none'}`,
        `  Mezon ID: ${user.mezonId}`,
      ].join('\n'),
    );
  }

  /**
   * Look up any user by mezonId or internal UUID.
   * Only available to admins.
   */
  private async showUserInfo(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const senderUser = (ctx as any).dbUser;
    const senderRole = Number(senderUser?.role);
    if (senderRole !== UserRole.ADMIN && senderRole !== UserRole.PM) {
      await this.reply(
        message,
        '❌ This command is only available to administrators and project managers.',
      );
      return;
    }

    const rawIdentifier = args[1];
    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*user info <mezonId|userId|@username>`',
      );
      return;
    }

    const identifier = this.normalizeUserIdentifier(rawIdentifier, message);
    let user = await this.userService.findByIdentifier(identifier, true);

    if (!user) {
      await this.reply(message, `❌ User **${rawIdentifier}** not found.`);
      return;
    }

    user = await this.refreshUserRoleFromClan(user, ctx);

    await this.reply(
      message,
      [
        `👤 **User Info:**`,
        `  Name: ${user.name ?? '—'}`,
        `  Email: ${user.email ?? '—'}`,
        `  Role: ${this.getRoleLabel(user.role ?? UserRole.UK)}`,
        `  Status: ${user.status ?? '—'}`,
        `  Mezon ID: ${user.mezonId}`,
      ].join('\n'),
    );
  }

  /**
   * Search for a user by mezonId or internal UUID.
   * Public command, shows basic info.
   */
  private async searchUser(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const rawIdentifier = args[1];

    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*user search <mezonId|userId|@username>`',
      );
      return;
    }

    const identifier = this.normalizeUserIdentifier(rawIdentifier, message);
    let user = await this.userService.findByIdentifier(identifier, true);

    if (!user) {
      await this.reply(message, `❌ User **${identifier}** not found.`);
      return;
    }

    user = await this.refreshUserRoleFromClan(user, ctx);

    await this.reply(
      message,
      [
        `👤 **User Found:**`,
        `  Name: ${user.name ?? '—'}`,
        `  Role: ${this.getRoleLabel(user.role ?? UserRole.UK)}`,
        `  Status: ${user.status ?? '—'}`,
        `  Mezon ID: ${user.mezonId}`,
      ].join('\n'),
    );
  }

  /**
   * Create a user from a clan member mention.
   * Attempts to pull role information from the clan structure.
   * Only PM and Admin can create users.
   */
  private async createUserFromMention(
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    try {
      const senderUser = (ctx as any).dbUser;
      const userRole = Number(senderUser?.role);
      if (userRole !== UserRole.PM && userRole !== UserRole.ADMIN) {
        await this.reply(
          message,
          '❌ Only project managers and administrators can create users.',
        );
        return;
      }

      const mentions = (message.raw as any).mentions || [];

      if (mentions.length === 0) {
        await this.reply(
          message,
          '❌ Please mention a user: `*user create @username`',
        );
        return;
      }

      const mention = mentions[0];
      const mezonId = mention.user_id != null ? String(mention.user_id) : '';

      if (!mezonId) {
        await this.reply(message, '❌ Could not extract user ID from mention.');
        return;
      }

      const existingUser = await this.userService.findByMezonId(mezonId, true);
      if (
        existingUser &&
        existingUser.status !== null &&
        existingUser.status !== UserStatus.DELETED
      ) {
        await this.reply(
          message,
          `ℹ️ Create Administrator user (Mezon ID: ${mezonId}).`,
        );
        return;
      }

      const clan = await ctx.getClan();
      if (!clan) {
        await this.reply(message, '❌ Could not resolve clan information.');
        return;
      }

      let internalRole = UserRole.UK;
      let memberName = `User_${mezonId.slice(-8)}`;

      const mentionRoleName = String((mention as any).rolename || '').trim();
      const mentionRoleId = String((mention as any).role_id || '').trim();

      if (mentionRoleName) {
        internalRole = mapMezonRoleToUserRole(mentionRoleName);
      } else if (mentionRoleId && mentionRoleId !== '0') {
        try {
          const rolesData = await (clan as any).listRoles?.();
          const roles = rolesData?.roles || rolesData || [];
          const memberRole = Array.isArray(roles)
            ? roles.find((r: any) => String(r.id) === mentionRoleId)
            : undefined;
          const roleName = String(
            memberRole?.name || memberRole?.rolename || '',
          ).trim();
          if (roleName) {
            internalRole = mapMezonRoleToUserRole(roleName);
          }
        } catch (e) {
          this.logger.debug(
            `Could not resolve clan role metadata: ${(e as Error).message}`,
          );
        }
      }

      const newUser = await this.userService.upsertByMezonId(mezonId, {
        name: memberName,
        role: internalRole,
      });

      if (internalRole !== UserRole.UK && newUser.id) {
        try {
          await (this.userService as any).userRepository.update(
            { id: newUser.id },
            { role: internalRole },
          );
        } catch (e) {
          this.logger.warn(
            `Could not update user role: ${(e as Error).message}`,
          );
        }
      }

      await this.reply(
        message,
        [
          `✅ **User Created:**`,
          `  Name: ${memberName}`,
          `  Role: ${this.getRoleLabel(internalRole)}`,
          `  Mezon ID: ${mezonId}`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error('Create user failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async listUsers(message: ManagedMessage): Promise<void> {
    const users = await this.userService.listAll();

    if (users.length === 0) {
      await this.reply(message, 'ℹ️ No users found.');
      return;
    }
    const lines = users.map((u) => {
      const roleLabel = this.getRoleLabel(u.role ?? UserRole.UK);
      const status = u.status ?? '—';
      return `  - ${u.name ?? '—'} (${u.mezonId}) | ${roleLabel} | ${status}`;
    });

    await this.reply(message, ['👤 **User List:**', ...lines].join('\n'));
  }

  private async deleteUser(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isAdministrator(ctx)) {
      await this.reply(message, '❌ Only administrators can delete users.');
      return;
    }

    const rawIdentifier = args[1];
    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*user delete <mezonId|userId|@username>`',
      );
      return;
    }

    const identifier = this.normalizeUserIdentifier(rawIdentifier, message);
    const user = await this.userService.findByIdentifier(identifier);

    if (!user) {
      await this.reply(message, `❌ User **${rawIdentifier}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete user **${user.name ?? user.mezonId}**?`,
        `Run: \`*user confirm delete ${identifier}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmDeleteUser(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    if (!this.isAdministrator(ctx)) {
      await this.reply(message, '❌ Only administrators can delete users.');
      return;
    }

    const rawIdentifier = args[2];
    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*user confirm delete <mezonId|userId|@username>`',
      );
      return;
    }

    const identifier = this.normalizeUserIdentifier(rawIdentifier, message);
    const user = await this.userService.findByIdentifier(identifier);

    if (!user) {
      await this.reply(message, `❌ User **${rawIdentifier}** not found.`);
      return;
    }

    await this.userService.softDeleteUser(identifier);
    await this.reply(
      message,
      `🗑️ User **${user.name ?? user.mezonId}** was deleted.`,
    );
  }

  private async refreshUserRoleFromClan(
    user: UserEntity,
    ctx: NezonCommandContext,
  ): Promise<UserEntity> {
    if (!user?.mezonId) {
      return user;
    }

    try {
      const clan = await ctx.getClan();
      if (!clan) {
        return user;
      }

      const rolesData = await (clan as any).listRoles?.();
      const roles =
        rolesData?.roles?.roles ?? rolesData?.roles ?? rolesData ?? [];
      if (!Array.isArray(roles)) {
        return user;
      }

      const resolvedRole = resolveBestMezonRoleForUser(roles, user.mezonId);

      if (shouldSyncResolvedUserRole(user.role, resolvedRole)) {
        return await this.userService.upsertByMezonId(user.mezonId, {
          role: resolvedRole,
        });
      }
    } catch (error) {
      this.logger.debug(
        `Could not refresh role for ${user.mezonId}: ${(error as Error).message}`,
      );
    }

    return user;
  }

  private isAdministrator(ctx: NezonCommandContext): boolean {
    const senderUser = (ctx as any).dbUser;
    return Number(senderUser?.role) === UserRole.ADMIN;
  }

  private getRoleLabel(
    role: UserRole | string | number | null | undefined,
  ): string {
    switch (Number(role)) {
      case UserRole.ADMIN:
        return 'Administrator';
      case UserRole.PM:
        return 'Project Manager';
      case UserRole.DEV:
        return 'Developer';
      case UserRole.QA:
        return 'QA';
      default:
        return 'Member';
    }
  }

  private normalizeUserIdentifier(
    identifier: string,
    message: ManagedMessage,
  ): string {
    const trimmed = identifier.trim();
    if (!trimmed.startsWith('@')) {
      return trimmed;
    }

    const mentionName = trimmed.slice(1).trim().toLowerCase();
    const mentions = (message.raw as any).mentions || [];
    const contentText = String((message.raw as any).content?.t || '').trim();

    const mention = (mentions as any[]).find((item: any) => {
      const candidateValues = [
        item.user_id,
        item.id,
        item.username,
        item.display_name,
        item.rolename,
      ]
        .filter(Boolean)
        .map((value: any) => String(value).trim().toLowerCase())
        .map((value: string) =>
          value.startsWith('@') ? value.slice(1) : value,
        );

      if (
        typeof item.s === 'number' &&
        typeof item.e === 'number' &&
        contentText.length >= item.e
      ) {
        const rangeText = String(contentText.slice(item.s, item.e))
          .trim()
          .toLowerCase();
        if (rangeText) {
          candidateValues.push(
            rangeText.startsWith('@') ? rangeText.slice(1) : rangeText,
          );
        }
      }

      return candidateValues.includes(mentionName);
    });

    return mention?.user_id || mentionName;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        response != null &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const msg = (response as any).message;
        if (Array.isArray(msg)) return msg.join(', ');
        if (typeof msg === 'string') return msg;
      }
    }
    return 'User command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
