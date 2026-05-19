import { Injectable, Logger, UseGuards } from '@nestjs/common';
import { ChannelMessage, Events } from 'mezon-sdk';
import {
  AutoContext,
  Command,
  ManagedMessage,
  On,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';

/**
 * Main channel message handler.
 *
 * - Handles raw channel messages (non-command)
 * - Provides *ping and *help commands for testing/discovery
 */
@Injectable()
export default class ChannelMessageHandler {
  private readonly logger = new Logger(ChannelMessageHandler.name);

  constructor() {}

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

  /**
   * Simple health-check command.
   * Usage: *ping
   */
  @Command('ping')
  @UseGuards(NezonAuthGuard)
  async handlePing(
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    this.logger.log(`*ping from sender: ${message.senderId}`);
    await message.reply(
      SmartMessage.text('🏓 Pong! Bot is alive and running.'),
    );
  }
}
