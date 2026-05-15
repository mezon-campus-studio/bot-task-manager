import { Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';

@Injectable()
@UseGuards(NezonAuthGuard)
export class HelpCommandHandler {
  private readonly logger = new Logger(HelpCommandHandler.name);

  @Command('help')
  async handleHelpCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    const category = args[0]?.toLowerCase();

    try {
      switch (category) {
        case 'user':
          await this.showUserHelp(message);
          return;
        case 'project':
          await this.showProjectHelp(message);
          return;
        case 'team':
          await this.showTeamHelp(message);
          return;
        case 'member':
          await this.showMemberHelp(message);
          return;
        case 'ticket':
          await this.showTicketHelp(message);
          return;
        case 'task':
          await this.showTaskHelp(message);
          return;
        default:
          await this.showGeneralHelp(message);
      }
    } catch (error) {
      this.logger.warn('Help command failed', (error as Error)?.stack);
      await this.reply(message, 'Help command failed.');
    }
  }

  private async showGeneralHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '🤖 **Mezon Bot Commands**',
        '',
        '**User Management:**',
        '  `*user create @username` – Add a user from clan mention',
        '  `*user info @username|userId` – View user details',
        '  `*user list` – List all users',
        '',
        '**Project Management:**',
        '  `*project list` – List your projects',
        '  `*project create <slug> <name...>` – Create a new project',
        '  `*project use <projectId|projectSlug>` – Select a project',
        '  `*project current` – Show current project',
        '  `*project exit` – Exit current project',
        '',
        '**Team Management:**',
        '  `*team list` – List teams in current project',
        '  `*team create <slug> <name> [@leader]` – Create a team',
        '  `*team info <teamId|slug|@slug>` – View team details',
        '  `*team delete <teamId|slug|@slug>` – Prepare delete confirmation',
        '  `*team confirm delete <teamId|slug|@slug>` – Confirm delete',
        '',
        '**Team Member Management:**',
        '  `*member list <teamId|@teamName>` – List team members',
        '  `*member add <teamId|@teamName> <userId|@userName>` – Add member',
        '  `*member remove <teamId|@teamName> <userId|@userName>` – Remove member',
        '',
        '**Ticket Management:**',
        '  `*ticket create <title...>` – Create a ticket',
        '  `*ticket list` – List tickets in current project',
        '  `*ticket assign <ticketId> <userId|@userName>` – Assign ticket',
        '  `*ticket status <ticketId> <status>` – Update ticket status',
        '  `*ticket resolve <ticketId>` – Resolve ticket',
        '',
        '**Task Management:**',
        '  `*task create <title...>` – Create a task',
        '  `*task list` – List tasks',
        '  `*task assign <taskId> <userId|@userName>` – Assign task',
        '  `*task status <taskId> <status>` – Update task status',
        '  `*task complete <taskId>` – Complete task',
        '',
        'Use `*help <category>` for detailed help (e.g., `*help user`).',
      ].join('\n'),
    );
  }

  private async showUserHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '👤 **User Commands:**',
        '  `*user create @username` – Add a user from clan mention (PM only)',
        '  `*user info @username|userId` – View user details and role',
        '  `*user list` – List all users in the system',
      ].join('\n'),
    );
  }

  private async showProjectHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '📁 **Project Commands:**',
        '  `*project list` – List all projects you own',
        '  `*project create <slug> <name...>` – Create a new project',
        '  `*project use <projectId|projectSlug>` – Select a project to work with',
        '  `*project current` – Show your current selected project',
        '  `*project exit` – Exit the current project',
      ].join('\n'),
    );
  }

  private async showTeamHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '🏷️ **Team Commands:**',
        '  `*team list` – List all teams in current project',
        '  `*team create <slug> <name> [@leader]` – Create a new team',
        '  `*team info <teamId|slug|@slug>` – View team details',
        '  `*team delete <teamId|slug|@slug>` – Prepare delete confirmation',
        '  `*team confirm delete <teamId|slug|@slug>` – Confirm delete',
      ].join('\n'),
    );
  }

  private async showMemberHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '👥 **Team Member Commands:**',
        '  `*member list <teamId|@teamName>` – List members of a team',
        '  `*member add <teamId|@teamName> <userId|@userName>` – Add user to team',
        '  `*member remove <teamId|@teamName> <userId|@userName>` – Remove user from team',
      ].join('\n'),
    );
  }

  private async showTicketHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '🎫 **Ticket Commands:**',
        '  `*ticket create <title...>` – Create a new ticket',
        '  `*ticket list` – List tickets in current project',
        '  `*ticket assign <ticketId> <userId|@userName>` – Assign ticket to user',
        '  `*ticket status <ticketId> <status>` – Update ticket status (open, in_progress, closed)',
        '  `*ticket resolve <ticketId>` – Resolve ticket (PM only)',
      ].join('\n'),
    );
  }

  private async showTaskHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '📋 **Task Commands:**',
        '  `*task create <title...>` – Create a new task',
        '  `*task list` – List tasks in current project',
        '  `*task assign <taskId> <userId|@userName>` – Assign task to user',
        '  `*task status <taskId> <status>` – Update task status',
        '  `*task complete <taskId>` – Mark task as completed',
      ].join('\n'),
    );
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
