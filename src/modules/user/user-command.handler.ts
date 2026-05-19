import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  buildPaginationFooter,
  paginate,
} from '@src/common/utils/pagination.util';
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
        case 'detail':
          await this.showUserInfo(args, message, ctx);
          return;
        case 'search':
          await this.searchUser(args, message, ctx);
          return;
        case 'create':
          await this.createUserFromMention(message, ctx);
          return;
        case 'list':
          await this.listUsers(message, ctx, args);
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
              `┌─────────────────────────────`,
              `│ 👤 **User Commands**`,
              `├─────────────────────────────`,
              `│ \`*user me\`                                       – Show your profile`,
              `│ \`*user list [--page <number>]\`                   – List all users`,
              `│ \`*user info <@username|userId>\`                  – View user details`,
              `│ \`*user search <@username|userId>\`                – Search for a user`,
              `│ \`*user create @username\`                         – Add a user from clan mention`,
              `│ \`*user delete <@username|userId>\`                – Prepare deletion`,
              `│ \`*user confirm delete <@username|userId>\`        – Confirm deletion`,
              `└─────────────────────────────`,
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('User command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

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
        '❌ This command is only available to **Administrator** or **Project Manager**.',
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

    const statusIcon = this.getStatusIcon(user.status);
    const roleLabel = this.getRoleLabel(user.role ?? UserRole.UK);
    const roleIcon = this.getRoleIcon(user.role ?? UserRole.UK);
    const isDeleted = user.status === UserStatus.DELETED;

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 👤 **User Info**`,
        `├─────────────────────────────`,
        `│ 📛  Name      : ${user.name ?? '—'}`,
        `│ 📧  Email     : ${user.email ?? '—'}`,
        `│ ${roleIcon}  Role      : ${roleLabel}`,
        `│ ${statusIcon}  Status    : ${this.getStatusLabel(user.status)}`,
        `│ 🪪  Mezon ID  : \`${user.mezonId}\``,
        ...(user.currentProjectId != null
          ? [`│ 📁  Project   : #${user.currentProjectId}`]
          : []),
        ...(isDeleted && user.deletedAt != null
          ? [`│ 🗑️  Deleted   : ${this.formatDate(user.deletedAt)}`]
          : []),
        `│ 📅  Joined    : ${this.formatDate(user.createdAt)}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

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

    const statusIcon = this.getStatusIcon(user.status);
    const roleLabel = this.getRoleLabel(user.role ?? UserRole.UK);
    const roleIcon = this.getRoleIcon(user.role ?? UserRole.UK);

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🔍 **Search Result**`,
        `├─────────────────────────────`,
        `│ 📛  Name      : ${user.name ?? '—'}`,
        `│ ${roleIcon}  Role      : ${roleLabel}`,
        `│ ${statusIcon}  Status    : ${this.getStatusLabel(user.status)}`,
        `│ 🪪  Mezon ID  : \`${user.mezonId}\``,
        `│ 📅  Joined    : ${this.formatDate(user.createdAt)}`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async createUserFromMention(
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    try {
      const senderUser = (ctx as any).dbUser;
      const userRole = Number(senderUser?.role);
      if (userRole !== UserRole.ADMIN) {
        await this.reply(message, '❌ Only administrators can create users.');
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
        const isNewBootstrap = (ctx as any).isNewBootstrap === true;
        if (!isNewBootstrap) {
          await this.reply(
            message,
            `ℹ️ User already exists (Mezon ID: ${mezonId}).`,
          );
          return;
        }
      }

      const clan = await ctx.getClan();
      if (!clan) {
        await this.reply(message, '❌ Could not resolve clan information.');
        return;
      }

      const contentText = String((message.raw as any).content?.t || '').trim();
      let memberName = mention.display_name || mention.username || '';
      if (
        !memberName &&
        typeof mention.s === 'number' &&
        typeof mention.e === 'number'
      ) {
        const extractedName = contentText.slice(mention.s, mention.e).trim();
        if (extractedName) {
          memberName = extractedName.startsWith('@')
            ? extractedName.slice(1)
            : extractedName;
        }
      }
      if (!memberName) {
        memberName = `User_${mezonId.slice(-8)}`;
      }

      let internalRole = UserRole.UK;
      try {
        const rolesData = await (clan as any).listRoles?.();
        const roles =
          rolesData?.roles?.roles ?? rolesData?.roles ?? rolesData ?? [];
        if (Array.isArray(roles)) {
          const resolvedClanRole = resolveBestMezonRoleForUser(roles, mezonId);
          if (resolvedClanRole !== null) {
            internalRole = resolvedClanRole;
          }
        }
      } catch (e) {
        this.logger.warn(
          `Could not fetch real-time clan roles during creation for ${mezonId}: ${(e as Error).message}`,
        );
        const mentionRoleName = String((mention as any).rolename || '').trim();
        if (mentionRoleName) {
          internalRole = mapMezonRoleToUserRole(mentionRoleName);
        }
      }

      await this.userService.upsertByMezonId(mezonId, {
        name: memberName,
        role: internalRole,
      });

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
  private async listUsers(
    message: ManagedMessage,
    ctx: NezonCommandContext,
    args: string[] = [],
  ): Promise<void> {
    let page = 1;
    const pageFlagIndex = args.findIndex(
      (arg) => arg.toLowerCase() === '--page',
    );

    if (pageFlagIndex !== -1 && args[pageFlagIndex + 1]) {
      page = Math.max(1, parseInt(args[pageFlagIndex + 1], 10) || 1);
    } else {
      page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);
    }

    let clanRoles: any[] = [];
    try {
      const clan = await ctx.getClan();
      if (clan) {
        const rolesData = await (clan as any).listRoles?.();
        const roles =
          rolesData?.roles?.roles ?? rolesData?.roles ?? rolesData ?? [];
        if (Array.isArray(roles)) clanRoles = roles;
      }
    } catch (e) {
      this.logger.debug(
        `Could not fetch clan roles for list: ${(e as Error).message}`,
      );
    }

    const allUsers = await this.userService.listAll();

    if (allUsers.length === 0) {
      await this.reply(message, 'ℹ️ No users found.');
      return;
    }

    const refreshedUsers = await Promise.all(
      allUsers.map(async (u) => {
        if (!u.mezonId || clanRoles.length === 0) return u;
        const resolvedRole = resolveBestMezonRoleForUser(clanRoles, u.mezonId);
        if (shouldSyncResolvedUserRole(u.role, resolvedRole)) {
          return this.userService.upsertByMezonId(u.mezonId, {
            role: resolvedRole,
          });
        }
        return u;
      }),
    );

    const ROLE_SORT_ORDER: Record<number, number> = {
      [UserRole.ADMIN]: 0,
      [UserRole.PM]: 1,
      [UserRole.DEV]: 2,
      [UserRole.QA]: 3,
      [UserRole.UK]: 4,
    };

    const ROLE_HEADER: Record<number, string> = {
      [UserRole.ADMIN]: '👑 Administrator',
      [UserRole.PM]: '📋 Project Manager',
      [UserRole.DEV]: '💻 Developer',
      [UserRole.QA]: '🔍 QA',
      [UserRole.UK]: '❓ Unknown',
    };

    const sorted = [...refreshedUsers].sort((a, b) => {
      const ra = ROLE_SORT_ORDER[Number(a.role ?? UserRole.UK)] ?? 99;
      const rb = ROLE_SORT_ORDER[Number(b.role ?? UserRole.UK)] ?? 99;
      return ra !== rb ? ra - rb : (a.name ?? '').localeCompare(b.name ?? '');
    });

    const { items: pageUsers, meta } = paginate(sorted, page);

    const grouped = new Map<number, typeof pageUsers>();
    for (const u of pageUsers) {
      const key = Number(u.role ?? UserRole.UK);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(u);
    }

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 👤 **User List**`,
      `├─────────────────────────────`,
    ];

    const sortedKeys = [...grouped.keys()].sort(
      (a, b) => (ROLE_SORT_ORDER[a] ?? 99) - (ROLE_SORT_ORDER[b] ?? 99),
    );

    for (const roleKey of sortedKeys) {
      const group = grouped.get(roleKey)!;
      lines.push(`│ ${ROLE_HEADER[roleKey]} (${group.length})`);
      for (const u of group) {
        const statusIcon =
          u.status === 'active' ? '🟢' : u.status === 'inactive' ? '🟡' : '🔴';
        lines.push(`│   ${statusIcon} ${u.name ?? '—'}  \`${u.mezonId}\``);
      }
      lines.push(`│`);
    }

    lines.push(`├─────────────────────────────`);
    lines.push(`│ ${buildPaginationFooter(meta, '*user list')}`);
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
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

  private getRoleIcon(
    role: UserRole | string | number | null | undefined,
  ): string {
    switch (Number(role)) {
      case UserRole.ADMIN:
        return '👑';
      case UserRole.PM:
        return '📋';
      case UserRole.DEV:
        return '💻';
      case UserRole.QA:
        return '🔍';
      default:
        return '👤';
    }
  }

  private getStatusIcon(
    status: UserStatus | string | null | undefined,
  ): string {
    switch (status) {
      case UserStatus.ACTIVE:
        return '🟢';
      case UserStatus.INACTIVE:
        return '🟡';
      case UserStatus.DELETED:
        return '🔴';
      default:
        return '⚪';
    }
  }

  private getStatusLabel(
    status: UserStatus | string | null | undefined,
  ): string {
    switch (status) {
      case UserStatus.ACTIVE:
        return 'Active';
      case UserStatus.INACTIVE:
        return 'Inactive';
      case UserStatus.DELETED:
        return 'Deleted';
      default:
        return '—';
    }
  }

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
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
