import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { ChannelMessage, Events } from 'mezon-sdk';
import { RateLimiterService } from '@src/common/providers/rate-limiter.service';
import {
  AutoContext,
  Command,
  ManagedMessage,
  On,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';

@Injectable()
export default class ChannelMessageHandler {
  private readonly logger = new Logger(ChannelMessageHandler.name);

  constructor(private rateLimiter: RateLimiterService) {}

  // ─── General message listener ───────────────────────────────────────────────

  @On(Events.ChannelMessage)
  async onChannelMessage(message: ChannelMessage): Promise<void> {
    console.log('DEBUG MESSAGE:', JSON.stringify(message, null, 2));
    if (!message?.content) return;

    const content =
      typeof message.content === 'string'
        ? message.content
        : ((message.content as any)?.t ?? '');

    if (!content.trim().startsWith('*')) {
      this.logger.debug(
        `[${message.channel_id}] ${message.sender_id}: ${content.slice(0, 80)}`,
      );
    }
  }

  // ─── *ping ──────────────────────────────────────────────────────────────────

  @Command('ping')
  @UseGuards(NezonAuthGuard)
  async handlePing(
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    const senderId = message.senderId;

    if (!senderId) {
      this.logger.warn('*ping received without senderId');
      return;
    }

    if (!this.rateLimiter.isAllowed(senderId)) {
      if (this.rateLimiter.shouldNotifyLimitExceeded(senderId)) {
        this.logger.warn(
          `Rate limit exceeded for user ${senderId} on *ping command`,
        );
        await message.reply(
          SmartMessage.text(
            '⚠️ Too many commands. Please wait before sending another command.',
          ),
        );
      }

      return;
    }

    this.logger.log(`*ping from sender: ${senderId}`);
    await message.reply(
      SmartMessage.text('🏓 Pong! Bot is alive and running.'),
    );
  }
}
