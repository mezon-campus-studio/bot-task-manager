import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { NezonAuthGuard } from '@src/modules/auth/guards/nezon-auth.guard';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import { TeamService } from './team.service';

/**
 * Team command handler for the Mezon bot.
 *
 * Supported commands (prefix: *):
 *   *team list                         – List all teams in current project
 *   *team create <slug> <name...>      – Create a team in current project
 *   *team detail <teamId>              – View team detail
 *   *team delete <teamId>              – Remove a team from current project
 */
@Injectable()
@UseGuards(NezonAuthGuard)
export class TeamCommandHandler {
  private readonly logger = new Logger(TeamCommandHandler.name);

  constructor(
    private readonly projectContextService: ProjectContextService,
    private readonly teamService: TeamService,
  ) {}

  @Command('team')
  async handleTeamCommand(
    @Args() args: string[],
    @AutoContext('message') message: ManagedMessage,
  ): Promise<void> {
    const action = args[0]?.toLowerCase();
    const senderId = message.senderId;

    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    try {
      switch (action) {
        case 'list':
          await this.listTeams(senderId, message);
          return;
        case 'create':
          await this.createTeam(args, senderId, message);
          return;
        case 'detail':
          await this.detailTeam(args, senderId, message);
          return;
        case 'delete':
          await this.deleteTeam(args, senderId, message);
          return;
        default:
          await this.reply(
            message,
            [
              '🏷️ **Team Commands:**',
              '  `*team list` – List all teams in current project',
              '  `*team create <slug> <name>` – Create a new team',
              '  `*team detail <teamId>` – View team detail',
              '  `*team delete <teamId>` – Delete a team from current project',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Team command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── actions ────────────────────────────────────────────────────────────────

  private async listTeams(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const teams = await this.teamService.findByProjectId(context.projectId);

    if (!teams.length) {
      await this.reply(
        message,
        `No teams found in project **${context.project.name}**.`,
      );
      return;
    }

    const lines = teams.map(
      (t) =>
        `  [#${t.id}] ${t.name} (${t.slug})${t.isDefault ? ' ⭐ default' : ''}`,
    );

    await this.reply(
      message,
      [`🏷️ Teams in **${context.project.name}**:`, ...lines].join('\n'),
    );
  }

  private async createTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const slug = args[1];
    const name = args.slice(2).join(' ').trim();

    if (!slug || !name) {
      await this.reply(
        message,
        'Team slug and name are required.\nUsage: `*team create <slug> <name>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.createTeamInProject(context.projectId, {
      leaderId: context.user.id,
      name,
      slug,
    });

    await this.reply(
      message,
      `✅ Created team **${team.name}** (\`${team.slug}\`) in project **${context.project.name}**.`,
    );
  }

  private async detailTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseId(args[1]);

    if (teamId == null) {
      await this.reply(message, 'Usage: `*team detail <teamId>`');
      return;
    }

    // Get current project context — validates membership
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findById(teamId);

    if (!team) {
      await this.reply(message, `Team #${teamId} not found.`);
      return;
    }

    // Validate team belongs to the current project (prevents cross-project data leaks)
    if (team.projectId !== context.projectId) {
      await this.reply(
        message,
        `Team #${teamId} does not belong to your current project **${context.project.name}**.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `🏷️ **Team #${team.id}**`,
        `  Name: ${team.name}`,
        `  Slug: ${team.slug}`,
        `  Default: ${team.isDefault ? 'Yes ⭐' : 'No'}`,
        `  Leader ID: ${team.leaderId ?? 'none'}`,
        `  Project: ${context.project.name} (${context.project.slug})`,
      ].join('\n'),
    );
  }

  private async deleteTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseId(args[1]);

    if (teamId == null) {
      await this.reply(message, 'Usage: `*team delete <teamId>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    await this.teamService.deleteTeamFromProject(context.projectId, teamId);

    await this.reply(
      message,
      `🗑️ Team #${teamId} has been removed from project **${context.project.name}**.`,
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
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
    return 'Team command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
