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
        case 'note':
          await this.showNoteHelp(message);
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
        '  `*user me` – Show your profile and current project',
        '  `*user create @username` – Add a user from clan mention',
        '  `*user info @username|userId` – View user details (only Admin,PM can see roles)',
        '  `*user search @username|userId` – Search for a user by username or ID (all users can search)',
        '  `*user list` – List all users',
        '  `*user delete @username|userId` – Prepare delete confirmation',
        '  `*user confirm delete @username|userId` – Confirm user deletion',
        '',
        '**Project Management:**',
        '  `*project list` – List your projects',
        '  `*project create <slug> <name...>` – Create a new project',
        '  `*project use <projectId|projectSlug>` – Select a project',
        '  `*project current` – Show current project',
        '  `*project delete <projectId|projectSlug>` – Prepare delete confirmation',
        '  `*project confirm delete <projectId|projectSlug>` – Confirm project deletion',
        '  `*project exit` – Exit current project',
        '',
        '**Team Management:**',
        '  `*team list` – List teams in current project',
        '  `*team create <slug> <name> [@leader]` – Create a team',
        '  `*team detail | info <teamId|slug|@slug>` – View team details',
        '  `*team default <teamId|@slug>` – Set team as default in current project',
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
        '  `*ticket delete <ticketId>` – Prepare delete confirmation',
        '  `*ticket confirm delete <ticketId>` – Confirm ticket deletion',
        '',
        '**Task Management:**',
        '  `*task create <title...>` – Create a task',
        '  `*task list` – List tasks',
        '  `*task assign <taskId> <userId|@userName>` – Assign task',
        '  `*task detail <taskId>` – View task details',
        '  `*task status <taskId> <status>` – Update task status (todo, in_progress, done, cancelled)',
        '  `*task delete <taskId>` – Prepare delete confirmation',
        '  `*task confirm delete <taskId>` – Confirm task deletion',
        '',
        '**Note Management:**',
        '  `*note list` – List all notes in current project (no content)',
        '  `*note list <resourceType> <resourceId>` – List notes for a resource (includes content)',
        '  `*note create <resourceType> <resourceId> <content...>` – Create a note',
        '  `*note detail <noteId>` – View note detail (includes content)',
        '  `*note update <noteId> <content...>` – Update your note (includes content)',
        '  `*note delete <noteId>` – Prepare delete confirmation',
        '  `*note confirm delete <noteId>` – Confirm note deletion',
        '  `*note pin <noteId>` / `*note unpin <noteId>` – Pin or unpin your note',
        '  `*note share <noteId>` / `*note unshare <noteId>` – Share or unshare your note',
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
        '  `*user me` – Show your profile and current project',
        '  `*user create @username` – Add a user from clan mention',
        '  `*user info @username|userId` – View user details (only Admin,PM can see roles)',
        '  `*user search @username|userId` – Search for a user by username or ID (all users can search)',
        '  `*user list` – List all users',
        '  `*user delete @username|userId` – Prepare delete confirmation',
        '  `*user confirm delete @username|userId` – Confirm user deletion',
      ].join('\n'),
    );
  }

  private async showProjectHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '📁 **Project Commands:**',
        '  `*project list` – List all projects you can access',
        '  `*project create <slug> <name...>` – Create a new project',
        '  `*project use <projectId|projectSlug>` – Select a project to work with',
        '  `*project current` – Show your current selected project',
        '  `*project delete <projectId|projectSlug>` – Prepare delete confirmation',
        '  `*project confirm delete <projectId|projectSlug>` – Confirm project deletion',
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
        '  `*ticket delete <ticketId>` – Prepare delete confirmation',
        '  `*ticket confirm delete <ticketId>` – Confirm ticket deletion',
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
        '  `*task status <taskId> <status>` – Update task status (todo, in_progress, done, cancelled)',
        '  `*task delete <taskId>` – Prepare delete confirmation',
        '  `*task confirm delete <taskId>` – Confirm task deletion',
      ].join('\n'),
    );
  }

  private async showNoteHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        '📝 **Note Commands:**',
        '  `*note list` – List all notes in current project (no content)',
        '  `*note list <resourceType> <resourceId>` – List notes for a resource (includes content)',
        '  `*note create <resourceType> <resourceId> <content...>` – Create a note',
        '  `*note detail <id>` – View note detail',
        '  `*note update <id> <content...>` – Update your note',
        '  `*note delete <id>` – Prepare delete confirmation',
        '  `*note confirm delete <id>` – Confirm note deletion',
        '  `*note pin <id>` / `*note unpin <id>` – Pin or unpin your note',
        '  `*note share <id>` / `*note unshare <id>` – Share or unshare your note',
      ].join('\n'),
    );
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
