import { Injectable, Logger } from '@nestjs/common';
import { ChannelMessage, Events } from 'mezon-sdk';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  On,
  SmartMessage,
} from '@src/libs/nezon';

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
    // Ignore bot messages or empty content
    if (!message?.content) return;

    const content =
      typeof message.content === 'string'
        ? message.content
        : ((message.content as any)?.t ?? '');

    // Only log non-command messages for debugging
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
  async handlePing(
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    this.logger.log(`*ping from sender: ${message.senderId}`);
    await message.reply(
      SmartMessage.text('🏓 Pong! Bot is alive and running.'),
    );
  }

  // ─── *help ──────────────────────────────────────────────────────────────────

  /**
   * Lists all available bot commands.
   * Usage: *help
   */
  @Command({ name: 'help', aliases: ['h'] })
  async handleHelp(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    const topic = args[0]?.toLowerCase();

    if (topic) {
      await this.replyTopicHelp(topic, message);
      return;
    }

    await message.reply(
      SmartMessage.text(
        [
          '📖 **Bot Task Manager — Commands**',
          '',
          '**👤 User**',
          '  `*user me` — View your profile',
          '  `*user search <mezonId|userId>` — Search for a user',
          '  `*user create @username` — Create user from clan member',
          '  `*user info <mezonId|userId>` — Look up a user (admin/PM only)',
          '',
          '**📁 Project**',
          '  `*project use <slug>` — Switch active project',
          '  `*project current` — Show current project',
          '  `*project exit` — Exit current project',
          '',
          '**🏷️ Team**',
          '  `*team list` — List teams in current project',
          '  `*team create <slug> <name>` — Create a team',
          '  `*team detail <id>` — View team info',
          '  `*team delete <id>` — Delete a team',
          '',
          '**👥 Member**',
          '  `*member list <teamId>` — List team members',
          '  `*member add <teamId> <userId>` — Add user to team',
          '  `*member remove <teamId> <userId>` — Remove user from team',
          '',
          '**🎫 Ticket**',
          '  `*ticket list` — List tickets in current project',
          '  `*ticket create <title>` — Create a ticket',
          '  `*ticket detail <id>` — View ticket info',
          '  `*ticket status <id> <status>` — Update status',
          '  `*ticket assign <id> <userId>` — Assign ticket',
          '  `*ticket resolve <id>` — Mark as resolved',
          '  `*ticket delete <id>` — Delete a ticket',
          '',
          '**🔧 Other**',
          '  `*ping` — Check bot health',
          '  `*help` — Show this help',
          '',
          '💡 Most commands require you to select a project first with `*project use <slug>`.',
        ].join('\n'),
      ),
    );
  }

  // ─── topic help ─────────────────────────────────────────────────────────────

  private async replyTopicHelp(
    topic: string,
    message: ManagedMessage,
  ): Promise<void> {
    const topics: Record<string, string> = {
      user: [
        '👤 **User Commands:**',
        '  `*user me` — View your own profile',
        '  `*user search <mezonId|userId>` — Search for a user',
        '  `*user create @username` — Create user from clan member',
        '  `*user info <mezonId|userId>` — Look up another user (admin/PM only)',
      ].join('\n'),
      project: [
        '📁 **Project Commands:**',
        '  `*project use <slug>` — Set your active project',
        '  `*project current` — Show the active project info',
        '  `*project exit` — Deselect the current project',
      ].join('\n'),
      team: [
        '🏷️ **Team Commands:**',
        '  `*team list` — List all teams in current project',
        '  `*team create <slug> <name>` — Create a team',
        '  `*team detail <teamId>` — View team detail',
        '  `*team delete <teamId>` — Delete a team',
      ].join('\n'),
      member: [
        '👥 **Member Commands:**',
        '  `*member list <teamId>` — List active members of a team',
        '  `*member add <teamId> <userId>` — Add user to team',
        '  `*member remove <teamId> <userId>` — Remove user from team',
      ].join('\n'),
      ticket: [
        '🎫 **Ticket Commands:**',
        '  `*ticket list` — List tickets in current project',
        '  `*ticket create <title>` — Create a new ticket',
        '  `*ticket detail <id>` — View ticket detail',
        '  `*ticket status <id> <open|in_progress|resolved|closed>` — Update status',
        '  `*ticket assign <id> <userId>` — Assign ticket to a user',
        '  `*ticket resolve <id>` — Mark ticket as resolved',
        '  `*ticket delete <id>` — Delete a ticket',
      ].join('\n'),
    };

    const helpText = topics[topic];
    if (!helpText) {
      await message.reply(
        SmartMessage.text(
          `❓ Unknown topic **${topic}**. Available topics: ${Object.keys(topics).join(', ')}`,
        ),
      );
      return;
    }

    await message.reply(SmartMessage.text(helpText));
  }
}
