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
 *   *user info <userId>    – Look up a user by mezonId or internal UUID
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
          await this.showUserInfo(args, message);
          return;
        default:
          await this.reply(
            message,
            [
              '👤 **User Commands:**',
              '  `*user me` – View your own profile',
              '  `*user info <mezonId|userId>` – Look up another user',
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
   */
  private async showUserInfo(
    args: string[],
    message: ManagedMessage,
  ): Promise<void> {
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
