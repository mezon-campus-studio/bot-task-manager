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
        `┌─────────────────────────────`,
        `│ 🤖 **Task Management Bot**`,
        `├─────────────────────────────`,
        `│ 👤  User    : \`*help user\`     – Manage users`,
        `│ 📁  Project : \`*help project\`  – Manage projects & workspace`,
        `│ 🏷️  Team    : \`*help team\`     – Team creation & management`,
        `│ 👥  Member  : \`*help member\`   – Add/remove team members`,
        `│ 🎫  Ticket  : \`*help ticket\`   – Ticket workflow management`,
        `│ 🧩  Task    : \`*help task\`     – Task assignment & tracking`,
        `│ 📝  Note    : \`*help note\`     – Shared notes & pin system`,
        `├─────────────────────────────`,
        `│ 💡 Example: \`*help task\``,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showUserHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 👤 **User Commands**`,
        `├─────────────────────────────`,
        `│ \`*user me\`                                       – Show your profile`,
        `│ \`*user list [page]\`                              – List all users`,
        `│ \`*user info <@username|userId>\`                  – View user details`,
        `│ \`*user search <@username|userId>\`                – Search for a user`,
        `│ \`*user create @username\`                         – Add a user from clan mention`,
        `│ \`*user delete <@username|userId>\`                – Prepare deletion`,
        `│ \`*user confirm delete <@username|userId>\`        – Confirm deletion`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showProjectHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 📁 **Project Commands**`,
        `├─────────────────────────────`,
        `│ \`*project list [page]\`                           – List all accessible projects`,
        `│ \`*project create <slug> <name...>\`               – Create a new project`,
        `│ \`*project use <projectId|slug>\`                  – Select a project to work with`,
        `│ \`*project current\`                               – Show current selected project`,
        `│ \`*project exit\`                                  – Exit current project`,
        `│ \`*project delete <projectId|slug>\`               – Prepare deletion`,
        `│ \`*project confirm delete <projectId|slug>\`       – Confirm deletion`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showTeamHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🏷️ **Team Commands**`,
        `├─────────────────────────────`,
        `│ \`*team list [page]\`                              – List all teams in current project`,
        `│ \`*team create <slug> <name> [@leader]\`           – Create a new team`,
        `│ \`*team detail <teamId|slug>\`                     – View team detail`,
        `│ \`*team delete <teamId|slug>\`                     – Prepare deletion`,
        `│ \`*team confirm delete <teamId|slug>\`             – Confirm deletion`,
        `│ \`*team restore <slug>\`                           – Restore a soft-deleted team`,
        `│ \`*team default <teamId|slug>\`                    – Set default team for project`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showMemberHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 👥 **Member Commands**`,
        `├─────────────────────────────`,
        `│ \`*member list <teamId|slug> [--page N]\`          – List members of a team`,
        `│ \`*member add <teamId|slug> <userId|@username>\`   – Add user to team`,
        `│ \`*member remove <teamId|slug> <userId|@username>\`– Remove user from team`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showTicketHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🎫 **Ticket Commands**`,
        `├─────────────────────────────`,
        `│ \`*ticket list [page]\`                            – List tickets in current project`,
        `│ \`*ticket create <title> [--desc <description>]\`  – Create a ticket`,
        `│ \`*ticket detail <id>\`                            – View ticket detail`,
        `│ \`*ticket status <id> <status>\`                   – Update status`,
        `│ \`*ticket assign <id> <userId|@username>\`         – Assign ticket to user`,
        `│ \`*ticket resolve <id>\`                           – Mark ticket as resolved`,
        `│ \`*ticket delete <id>\`                            – Prepare deletion`,
        `│ \`*ticket confirm delete <id>\`                    – Confirm deletion`,
        `├─────────────────────────────`,
        `│ Statuses: \`OPEN | IN_PROGRESS | RESOLVED | CLOSED\``,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showTaskHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🧩 **Task Commands**`,
        `├─────────────────────────────`,
        `│ \`*task list [--page N] [--status <s>] [--q <kw>]\` – List tasks`,
        `│ \`*task create <title> [--desc <description>]\`      – Create a task`,
        `│ \`*task detail <id>\`                                – View task detail`,
        `│ \`*task status <id> <status>\`                       – Update status`,
        `│ \`*task assign <id> <userId|@username>\`             – Assign task`,
        `│ \`*task delete <id>\`                                – Prepare deletion`,
        `│ \`*task confirm delete <id>\`                        – Confirm deletion`,
        `├─────────────────────────────`,
        `│ Statuses: \`todo | in_progress | done | cancelled\``,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async showNoteHelp(message: ManagedMessage): Promise<void> {
    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 📝 **Note Commands**`,
        `├─────────────────────────────`,
        `│ \`*note list [type] [resourceId] [page]\`           – List notes`,
        `│ \`*note create <type> <resourceId> <content...>\`   – Create a note`,
        `│ \`*note detail <id>\`                               – View note detail`,
        `│ \`*note update <id> <content...>\`                  – Update your note`,
        `│ \`*note delete <id>\`                               – Prepare deletion`,
        `│ \`*note confirm delete <id>\`                       – Confirm deletion`,
        `│ \`*note pin <id>\` / \`*note unpin <id>\`             – Pin / Unpin`,
        `│ \`*note share <id>\` / \`*note unshare <id>\`         – Share / Make private`,
        `├─────────────────────────────`,
        `│ Types: \`USER | PROJECT | TEAM | TASK | TICKET | EVENT\``,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
