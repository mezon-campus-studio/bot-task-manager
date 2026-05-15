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
          '  `*user info <mezonId|userId>` — Look up a user (admin/project owner only)',
          '',
          '**📁 Project**',
          '  `*project list` — List projects',
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
          '**👥 Project Member**',
          '  `*project-member list` — List project members',
          '  `*project-member invite <userId>` — Invite user to project',
          '  `*project-member remove <userId>` — Remove user from project',
          '',
          '**📅 Event**',
          '  `*event list` — List events in current project',
          '  `*event create <ISO-date> <title>` — Create an event',
          '  `*event detail <id>` — View event info',
          '  `*event cancel <id>` — Cancel an event',
          '',
          '**🧩 Task**',
          '  `*task list` — List tasks in current project',
          '  `*task create <title>` — Create a task',
          '  `*task detail <id>` — View task info',
          '  `*task status <id> <todo|in_progress|done|cancelled>` — Update status',
          '  `*task assign <id> <userId>` — Assign task',
          '  `*task delete <id>` — Delete a task',
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
          '**Note**',
          '  `*note list <resourceType> <resourceId>` - List notes',
          '  `*note create <resourceType> <resourceId> <content...>` - Create a note',
          '  `*note detail <id>` - View note info',
          '  `*note update <id> <content...>` - Update your note',
          '  `*note delete <id>` - Delete your note',
          '',
          '**Role**',
          '  `*role list [SYSTEM|PROJECT|TEAM]` - List roles',
          '  `*role detail <id|key>` - View role info',
          '  `*role create <key> <scope> <name...>` - Create role (PM only)',
          '  `*role update <id> <field> <value...>` - Update role (PM only)',
          '  `*role delete <id>` - Delete role (PM only)',
          '',
          '**Permission**',
          '  `*permission list` - List permissions',
          '  `*permission detail <id|key>` - View permission info',
          '  `*permission create <key> <resource> <action> [description...]` - Create permission (PM only)',
          '  `*permission update <id> <field> <value...>` - Update permission (PM only)',
          '  `*permission delete <id>` - Delete permission (PM only)',
          '',
          '**Role Permission**',
          '  `*role-permission assign <roleId> <permissionId>` - Assign permission (PM only)',
          '  `*role-permission remove <roleId> <permissionId>` - Remove permission (PM only)',
          '  `*role-permission list-role <roleId>` - List permissions for role',
          '  `*role-permission list-permission <permissionId>` - List roles for permission',
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
        '  `*user info <mezonId|userId>` — Look up another user (admin/project owner only)',
      ].join('\n'),
      project: [
        '📁 **Project Commands:**',
        '  `*project list` — List available projects',
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
      'project-member': [
        '👥 **Project Member Commands:**',
        '  `*project-member list` — List members in current project',
        '  `*project-member invite <userId|@username>` — Invite user to current project',
        '  `*project-member remove <userId|@username>` — Remove user from current project',
      ].join('\n'),
      event: [
        '📅 **Event Commands:**',
        '  `*event list` — List events in current project',
        '  `*event create <ISO-date> <title...>` — Create a scheduled event',
        '  `*event detail <id>` — View event detail',
        '  `*event cancel <id>` — Cancel an event',
      ].join('\n'),
      task: [
        '🧩 **Task Commands:**',
        '  `*task list` — List tasks in current project',
        '  `*task create <title>` — Create a new task',
        '  `*task detail <id>` — View task detail',
        '  `*task status <id> <todo|in_progress|done|cancelled>` — Update status',
        '  `*task assign <id> <userId>` — Assign task to a user',
        '  `*task delete <id>` — Delete a task',
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
      note: [
        'Note Commands:',
        '  `*note list <resourceType> <resourceId>` - List notes',
        '  `*note create <resourceType> <resourceId> <content...>` - Create a note',
        '  `*note detail <id>` - View note detail',
        '  `*note update <id> <content...>` - Update your note',
        '  `*note delete <id>` - Delete your note',
        '  `*note pin <id>` / `*note unpin <id>` - Pin or unpin your note',
        '  `*note share <id>` / `*note unshare <id>` - Share or unshare your note',
      ].join('\n'),
      role: [
        'Role Commands:',
        '  `*role list [SYSTEM|PROJECT|TEAM]` - List roles',
        '  `*role detail <id|key>` - View role detail',
        '  `*role create <key> <SYSTEM|PROJECT|TEAM> <name...>` - Create role (PM only)',
        '  `*role update <id> <key|name|scope|description> <value...>` - Update role (PM only)',
        '  `*role delete <id>` - Delete role (PM only)',
      ].join('\n'),
      permission: [
        'Permission Commands:',
        '  `*permission list` - List permissions',
        '  `*permission detail <id|key>` - View permission detail',
        '  `*permission create <key> <resource> <action> [description...]` - Create permission (PM only)',
        '  `*permission update <id> <key|resource|action|description> <value...>` - Update permission (PM only)',
        '  `*permission delete <id>` - Delete permission (PM only)',
      ].join('\n'),
      'role-permission': [
        'Role-Permission Commands:',
        '  `*role-permission assign <roleId> <permissionId>` - Assign permission to role (PM only)',
        '  `*role-permission remove <roleId> <permissionId>` - Remove permission from role (PM only)',
        '  `*role-permission list-role <roleId>` - List permissions assigned to role',
        '  `*role-permission list-permission <permissionId>` - List roles assigned to permission',
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
