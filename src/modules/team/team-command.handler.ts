import { HttpException, Injectable, Logger } from '@nestjs/common';
import {
  Args,
  AutoContext,
  Command,
  ManagedMessage,
  SmartMessage,
} from '@src/libs/nezon';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import { TeamService } from './team.service';

@Injectable()
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
        case 'create':
          await this.createTeam(args, senderId, message);
          return;
        case 'assign':
          await this.assignTeam(args, senderId, message);
          return;
        case 'delete':
          await this.deleteTeam(args, senderId, message);
          return;
        default:
          await this.reply(
            message,
            'Usage: *team create <slug> <name>, *team assign <teamId>, *team delete <teamId>',
          );
      }
    } catch (error) {
      this.logger.warn('Team command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async createTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const slug = args[1];
    const name = args.slice(2).join(' ').trim();

    if (!slug || !name) {
      await this.reply(message, 'Team slug and name are required.');
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
      `Created team ${team.name} (${team.slug}) in project ${context.project.slug}.`,
    );
  }

  private async assignTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseTeamId(args[1]);

    if (teamId == null) {
      await this.reply(message, 'Team id is required.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const team = await this.teamService.assignTeamToProject(
      context.projectId,
      teamId,
    );

    await this.reply(
      message,
      `Assigned team ${team.name} (${team.slug}) to project ${context.project.slug}.`,
    );
  }

  private async deleteTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseTeamId(args[1]);

    if (teamId == null) {
      await this.reply(message, 'Team id is required.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    await this.teamService.deleteTeamFromProject(context.projectId, teamId);
    await this.reply(message, `Deleted team ${teamId} from current project.`);
  }

  private parseTeamId(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const teamId = Number(value);

    if (!Number.isInteger(teamId) || teamId <= 0) {
      return null;
    }

    return teamId;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (
        response != null &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const message = response.message;

        if (Array.isArray(message)) {
          return message.join(', ');
        }

        if (typeof message === 'string') {
          return message;
        }
      }
    }

    return 'Team command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
