import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
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
import { UserService } from './user.service';

/**
 * User command handler for the Mezon bot.
 *
 * Supported commands (prefix: *):
 *   *user me               – Show your own profile (name, role, current project)
 *   *user search <userId>  – Search for a user by mezonId or internal UUID
 *   *user info <userId>    – Look up a user by mezonId or internal UUID (admin/PM only)
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
          await this.searchUser(args, message);
          return;
        case 'create':
          await this.createUserFromMention(args, message);
          return;
        default:
          await this.reply(
            message,
            [
              '👤 **User Commands:**',
              '  `*user me` – View your own profile',
              '  `*user search <mezonId|userId>` – Search for a user',
              '  `*user info <mezonId|userId>` – Look up another user (admin/PM only)',
              '  `*user create @username` – Create user from clan member',
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
    // NezonAuthGuard already resolved and attached the DB user
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
        `  Role: ${user.role ?? 'UK'}`,
        `  Status: ${user.status ?? '—'}`,
        `  Current Project ID: ${user.currentProjectId ?? 'none'}`,
        `  Mezon ID: ${user.mezonId}`,
      ].join('\n'),
    );
  }

  /**
   * Look up any user by mezonId or internal UUID.
   * Only available to admins and project managers.
   */
  private async showUserInfo(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    // Check if sender has admin or PM role
    const senderUser = (ctx as any).dbUser;
    if (!senderUser || !['AD', 'PM'].includes(senderUser.role)) {
      await this.reply(
        message,
        '❌ This command is only available to administrators and project managers.',
      );
      return;
    }

    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*user info <mezonId|userId>`');
      return;
    }

    // Try mezonId first, then internal UUID
    const user =
      (await this.userService.findByMezonId(identifier)) ??
      (await this.userService.findById(identifier));

    if (!user) {
      await this.reply(message, `❌ User **${identifier}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `👤 **User Info:**`,
        `  Name: ${user.name ?? '—'}`,
        `  Email: ${user.email ?? '—'}`,
        `  Role: ${user.role ?? 'UK'}`,
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
  ): Promise<void> {
    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*user search <mezonId|userId>`');
      return;
    }

    // Use findByIdentifier which tries both mezonId and UUID
    const user = await this.userService.findByIdentifier(identifier, true);

    if (!user) {
      await this.reply(message, `❌ User **${identifier}** not found.`);
      return;
    }

    await this.reply(
      message,
      [
        `👤 **User Found:**`,
        `  Name: ${user.name ?? '—'}`,
        `  Role: ${user.role ?? 'UK'}`,
        `  Status: ${user.status ?? '—'}`,
        `  Mezon ID: ${user.mezonId}`,
      ].join('\n'),
    );
  }

  /**
   * Create a user from a clan member mention.
   * Attempts to pull role information from the clan structure.
   */
  private async createUserFromMention(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
    const mentionStr = args[1];

    if (!mentionStr) {
      await this.reply(message, 'Usage: `*user create @username`');
      return;
    }

    // Parse mention (remove @ if present)
    const username = mentionStr.replace(/^@/, '').trim();

    if (!username) {
      await this.reply(message, 'Please provide a valid username.');
      return;
    }

    try {
      // Get clan from channel
      const channel = (message as any).channel;
      const clan = channel?.clan;

      if (!clan) {
        await this.reply(message, '❌ Could not resolve clan information.');
        return;
      }

      // List members in clan to find matching username
      // Note: This assumes Mezon SDK provides a way to list members
      // If not available, we'll need to use an alternative approach
      let targetMember: any = null;
      let memberRole: any = null;

      try {
        // Try to get members (this is SDK-dependent)
        const membersData = await (clan as any).listMembers?.();
        const members = membersData?.members || [];

        targetMember = members.find(
          (m: any) =>
            m.user?.username === username ||
            m.user?.display_name === username ||
            m.user?.user_id === username,
        );

        if (targetMember) {
          // Get roles from clan
          const rolesData = await (clan as any).listRoles?.();
          const roles = rolesData?.roles?.roles || [];

          // Find the role of this member
          const roleId = targetMember.role_ids?.[0];
          if (roleId) {
            memberRole = roles.find((r: any) => r.id === roleId);
          }
        }
      } catch (e) {
        this.logger.debug(
          `Could not fetch members list from clan: ${(e as Error).message}`,
        );
      }

      if (!targetMember) {
        await this.reply(
          message,
          `❌ Member **${username}** not found in this clan.`,
        );
        return;
      }

      const mezonId = targetMember.user?.user_id || targetMember.user_id;
      if (!mezonId) {
        await this.reply(
          message,
          '❌ Could not determine Mezon ID for this user.',
        );
        return;
      }

      // Check if user already exists
      const existingUser = await this.userService.findByMezonId(mezonId);
      if (existingUser) {
        await this.reply(
          message,
          `ℹ️ User **${targetMember.user?.username}** already exists in the system.`,
        );
        return;
      }

      // Map clan role to internal role (Owner -> AD, Bot -> UK, etc.)
      let internalRole = 'UK'; // Default unknown
      const roleName = memberRole?.name?.toUpperCase() || '';
      if (roleName.includes('OWNER') || roleName.includes('ADMIN')) {
        internalRole = 'AD';
      } else if (
        roleName.includes('MANAGER') ||
        roleName.includes('PROJECT') ||
        roleName.includes('PM')
      ) {
        internalRole = 'PM';
      }

      // Create user with role from clan
      const newUser = await this.userService.upsertByMezonId(mezonId, {
        name: targetMember.user?.username || targetMember.user?.display_name,
      });

      // Update the role in database
      if (internalRole !== 'UK' && newUser.id) {
        await (this.userService as any).userRepository.update(
          { id: newUser.id },
          { role: internalRole },
        );
      }

      await this.reply(
        message,
        [
          `✅ **User Created:**`,
          `  Name: ${targetMember.user?.username || targetMember.user?.display_name}`,
          `  Role: ${internalRole}`,
          `  Mezon ID: ${mezonId}`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error('Create user failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

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
