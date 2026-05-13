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
import { TeamService } from '@src/modules/team/team.service';
import { UserService } from '@src/modules/user/user.service';
import { TeamMemberService } from './team-member.service';

/**
 * Team-Member command handler for the Mezon bot.
 *
 * Supported commands (prefix: *):
 *   *member list <teamId>                  – List all members of a team
 *   *member add <teamId> <userId>          – Add a member to team in current project
 *   *member remove <teamId> <userId>       – Remove a member from team in current project
 */
@Injectable()
@UseGuards(NezonAuthGuard)
export class TeamMemberCommandHandler {
  private readonly logger = new Logger(TeamMemberCommandHandler.name);

  constructor(
    private readonly teamMemberService: TeamMemberService,
    private readonly teamService: TeamService,
    private readonly projectContextService: ProjectContextService,
    private readonly userService: UserService,
  ) {}

  @Command('member')
  async handleMemberCommand(
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
          await this.listMembers(args, senderId, message);
          return;
        case 'add':
          await this.addMember(args, senderId, message);
          return;
        case 'remove':
          await this.removeMember(args, senderId, message);
          return;
        default:
          await this.reply(
            message,
            [
              '👥 **Member Commands:**',
              '  `*member list <teamId>` – List members of a team',
              '  `*member add <teamId> <userId>` – Add user to team',
              '  `*member remove <teamId> <userId>` – Remove user from team',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Member command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listMembers(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseId(args[1]);

    if (teamId == null) {
      await this.reply(message, 'Usage: `*member list <teamId>`');
      return;
    }

    // Validate user has a current project and is an active member
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    // Validate team belongs to current project
    const team = await this.teamService.findById(teamId);
    if (!team || team.projectId !== context.projectId) {
      await this.reply(
        message,
        `Team #${teamId} does not belong to your current project **${context.project.name}**.`,
      );
      return;
    }

    const members =
      await this.teamMemberService.findActiveMembersByTeamId(teamId);

    if (!members.length) {
      await this.reply(
        message,
        `No active members found in team #${teamId} (${team.name}).`,
      );
      return;
    }

    const lines = members.map(
      (m, i) => `  ${i + 1}. userId: ${m.userId} — status: ${m.status}`,
    );

    await this.reply(
      message,
      [`👥 Members of **${team.name}** (team #${teamId}):`, ...lines].join(
        '\n',
      ),
    );
  }

  private async addMember(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseId(args[1]);
    const targetUserId = args[2];

    if (teamId == null || !targetUserId) {
      await this.reply(message, 'Usage: `*member add <teamId> <userId>`');
      return;
    }

    // Resolve the target user by mezonId or internal id
    const targetUser =
      (await this.userService.findByMezonId(targetUserId)) ??
      (await this.userService.findById(targetUserId));

    if (!targetUser) {
      await this.reply(
        message,
        `User **${targetUserId}** not found in the system.`,
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    await this.teamMemberService.addMember(
      context.projectId,
      teamId,
      targetUser.id,
      context.user.id,
    );

    await this.reply(
      message,
      `✅ User **${targetUser.name ?? targetUser.mezonId}** added to team #${teamId} in project **${context.project.name}**.`,
    );
  }

  private async removeMember(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const teamId = this.parseId(args[1]);
    const targetUserId = args[2];

    if (teamId == null || !targetUserId) {
      await this.reply(message, 'Usage: `*member remove <teamId> <userId>`');
      return;
    }

    // Resolve the target user
    const targetUser =
      (await this.userService.findByMezonId(targetUserId)) ??
      (await this.userService.findById(targetUserId));

    if (!targetUser) {
      await this.reply(
        message,
        `User **${targetUserId}** not found in the system.`,
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    await this.teamMemberService.removeMember(
      context.projectId,
      teamId,
      targetUser.id,
    );

    await this.reply(
      message,
      `🗑️ User **${targetUser.name ?? targetUser.mezonId}** removed from team #${teamId}.`,
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
    return 'Member command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
