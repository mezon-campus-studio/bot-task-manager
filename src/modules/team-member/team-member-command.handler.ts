import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  Args,
  AutoContext,
  Command,
  Context,
  ManagedMessage,
  NezonCommandContext,
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
    @Context() ctx: NezonCommandContext,
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
          await this.addMember(args, senderId, message, ctx);
          return;
        case 'remove':
          await this.removeMember(args, senderId, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              '👥 **Member Commands:**',
              '  `*member list <teamId|slug|@slug>` – List members of a team',
              '  `*member add <teamId|slug|@slug> <userId|@username>` – Add user to team',
              '  `*member remove <teamId|slug|@slug> <userId|@username>` – Remove user from team',
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
    const teamIdentifier = args[1];

    if (!teamIdentifier) {
      await this.reply(message, 'Usage: `*member list <teamId|slug|@slug>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      teamIdentifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${teamIdentifier}** not found in your current project **${context.project.name}**.`,
      );
      return;
    }

    const teamId = team.id;

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
    ctx: NezonCommandContext,
  ): Promise<void> {
    const teamIdentifier = args[1];
    const targetUserIdRaw = args[2];

    if (!teamIdentifier || !targetUserIdRaw) {
      await this.reply(
        message,
        'Usage: `*member add <teamId|slug|@slug> <userId|@username>`',
      );
      return;
    }

    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers and administrators can add team members.',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      teamIdentifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${teamIdentifier}** not found in your current project **${context.project.name}**.`,
      );
      return;
    }

    const resolvedTargetUserId =
      this.getMentionedUserIdentifier(targetUserIdRaw, message) ??
      targetUserIdRaw.replace(/^@/, '').trim();

    // Resolve the target user
    const targetUser =
      await this.userService.findByIdentifier(resolvedTargetUserId);

    if (!targetUser) {
      await this.reply(
        message,
        `User **${targetUserIdRaw}** not found in the system.`,
      );
      return;
    }

    await this.teamMemberService.addMember(
      context.projectId,
      team.id,
      targetUser.id,
      context.user.id,
    );

    await this.reply(
      message,
      `✅ User **${targetUser.name ?? targetUser.mezonId}** added to team **${team.name}** in project **${context.project.name}**.`,
    );
  }

  private async removeMember(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const teamIdentifier = args[1];
    const targetUserIdRaw = args[2];

    if (!teamIdentifier || !targetUserIdRaw) {
      await this.reply(
        message,
        'Usage: `*member remove <teamId|slug|@slug> <userId|@username>`',
      );
      return;
    }

    if (!this.isProjectManager(ctx)) {
      await this.reply(
        message,
        'Only project managers and administrators can remove team members.',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      teamIdentifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${teamIdentifier}** not found in your current project **${context.project.name}**.`,
      );
      return;
    }

    const resolvedTargetUserId =
      this.getMentionedUserIdentifier(targetUserIdRaw, message) ??
      targetUserIdRaw.replace(/^@/, '').trim();

    // Resolve the target user
    const targetUser =
      await this.userService.findByIdentifier(resolvedTargetUserId);

    if (!targetUser) {
      await this.reply(
        message,
        `User **${targetUserIdRaw}** not found in the system.`,
      );
      return;
    }

    await this.teamMemberService.removeMember(
      context.projectId,
      team.id,
      targetUser.id,
    );

    await this.reply(
      message,
      `🗑️ User **${targetUser.name ?? targetUser.mezonId}** removed from team **${team.name}**.`,
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private getMentionedUserIdentifier(
    identifier: string,
    message: ManagedMessage,
  ): string | null {
    const normalized = identifier.trim();
    if (!normalized.startsWith('@')) {
      return null;
    }

    const mentionName = normalized.slice(1).trim().toLowerCase();
    if (!mentionName) return null;

    const raw = message.raw as any;
    const mentions = Array.isArray(raw?.mentions) ? raw.mentions : [];
    const contentText = String(raw?.content?.t || '').trim();

    const matched = mentions.find((item: any) => {
      const candidateValues = [
        item.user_id,
        item.id,
        item.username,
        item.display_name,
        item.name,
        item.user_name,
      ]
        .filter(Boolean)
        .map((value: any) => String(value).trim().toLowerCase())
        .map((value: string) =>
          value.startsWith('@') ? value.slice(1) : value,
        );

      if (
        typeof item.s === 'number' &&
        typeof item.e === 'number' &&
        contentText.length >= item.e
      ) {
        const rangeText = String(contentText.slice(item.s, item.e))
          .trim()
          .toLowerCase();
        if (rangeText) {
          candidateValues.push(
            rangeText.startsWith('@') ? rangeText.slice(1) : rangeText,
          );
        }
      }

      return candidateValues.includes(mentionName);
    });

    return matched?.user_id || matched?.id || null;
  }

  private isProjectManager(ctx: any): boolean {
    const dbUser = ctx.dbUser;
    return dbUser?.role === UserRole.PM || dbUser?.role === UserRole.ADMIN;
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
