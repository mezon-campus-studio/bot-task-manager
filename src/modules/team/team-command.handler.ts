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
import { UserService } from '@src/modules/user/user.service';
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
    private readonly userService: UserService,
  ) {}

  @Command('team')
  async handleTeamCommand(
    @Args() args: string[],
    @Context() ctx: NezonCommandContext,
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
          await this.createTeam(args, senderId, message, ctx);
          return;
        case 'info':
        case 'detail':
          await this.detailTeam(args, senderId, message);
          return;
        case 'delete':
          await this.deleteTeam(args, senderId, message, ctx);
          return;
        case 'confirm':
          await this.confirmTeamCommand(args, senderId, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              '🏷️ **Team Commands:**',
              '  `*team list` – List all teams in current project',
              '  `*team create <slug> <name> [@leader]` – Create a new team',
              '  `*team info <teamId|slug|@slug>` – View team detail',
              '  `*team delete <teamId|slug|@slug>` – Prepare delete confirmation',
              '  `*team confirm delete <teamId|slug|@slug>` – Confirm delete',
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
    ctx: NezonCommandContext,
  ): Promise<void> {
    const slug = args[1];
    const rawNameParts = args.slice(2);

    if (!slug || rawNameParts.length === 0) {
      await this.reply(
        message,
        'Team slug and name are required.\nUsage: `*team create <slug> <name> [@leader]`,\nfor example: `*team create backend Backend Team @alice`',
      );
      return;
    }

    let leaderIdentifier: string | null = null;
    if (rawNameParts.length > 1) {
      const lastPart = rawNameParts[rawNameParts.length - 1];
      if (lastPart.startsWith('@')) {
        leaderIdentifier = lastPart;
        rawNameParts.pop();
      }
    }

    const name = rawNameParts.join(' ').trim();
    if (!name) {
      await this.reply(
        message,
        'Team name is required.\nUsage: `*team create <slug> <name> [@leader]`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can create teams.');
      return;
    }

    let leaderId = context.user.id;

    if (leaderIdentifier) {
      const resolvedLeaderIdentifier =
        this.getMentionedUserIdentifier(leaderIdentifier, message) ??
        leaderIdentifier.replace(/^@/, '').trim();

      if (resolvedLeaderIdentifier) {
        const leader = await this.userService.findByIdentifier(
          resolvedLeaderIdentifier,
          true,
        );
        if (leader) {
          leaderId = leader.id;
        }
      }
    }

    const team = await this.teamService.createTeamInProject(context.projectId, {
      leaderId,
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
    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*team detail <teamId|slug|@slug>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      identifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${identifier}** not found in project **${context.project.name}**.`,
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
    ctx: NezonCommandContext,
  ): Promise<void> {
    const identifier = args[1];

    if (!identifier) {
      await this.reply(
        message,
        'Usage: `*team delete <teamId|slug|@slug>`. To confirm deletion, run `*team confirm delete <team>`.',
      );
      return;
    }

    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can delete teams.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      identifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete team **${team.name}** (\`${team.slug}\`)?`,
        `Run: \`*team confirm delete ${team.id}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmTeamCommand(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const confirmAction = args[1]?.toLowerCase();
    const identifier = args[2];

    if (confirmAction !== 'delete' || !identifier) {
      await this.reply(
        message,
        'Usage: `*team confirm delete <teamId|slug|@slug>`',
      );
      return;
    }

    if (!this.isProjectManager(ctx)) {
      await this.reply(message, 'Only project managers can delete teams.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const team = await this.teamService.findByProjectIdentifier(
      context.projectId,
      identifier,
    );

    if (!team) {
      await this.reply(
        message,
        `Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    await this.teamService.deleteTeamFromProject(context.projectId, team.id);

    await this.reply(
      message,
      `🗑️ Team **${team.name}** (\`${team.slug}\`) was deleted from project **${context.project.name}**.`,
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

  private isProjectManager(ctx: NezonCommandContext): boolean {
    const dbUser = (ctx as any).dbUser;
    return dbUser?.role === UserRole.PM;
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
