import { HttpException, Injectable, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@src/common/enums/user.enum';
import {
  buildPaginationFooter,
  paginate,
} from '@src/common/utils/pagination.util';
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
    const dbUser = (ctx as any).dbUser;
    if (!dbUser) {
      await this.reply(message, 'User not found in database.');
      return;
    }

    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    try {
      switch (action) {
        case 'list':
          await this.listTeams(senderId, message, args);
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
        case 'restore':
          await this.restoreTeamCommand(args, senderId, message, ctx);
          return;
        case 'default':
          await this.setDefaultTeam(args, senderId, message, ctx);
          return;
        default:
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
    } catch (error) {
      this.logger.warn('Team command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── actions ────────────────────────────────────────────────────────────────

  private async listTeams(
    senderId: string,
    message: ManagedMessage,
    args: string[] = [],
  ): Promise<void> {
    const page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const teams = await this.teamService.findByProjectId(context.projectId);

    if (!teams.length) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ 🏷️ **Team List**`,
          `├─────────────────────────────`,
          `│ 📁 Project : ${context.project.name} (\`${context.project.slug}\`)`,
          `├─────────────────────────────`,
          `│ ℹ️  No teams found in this project.`,
          `│ Use \`*team create <slug> <name>\` to create one.`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    const { items: pageTeams, meta } = paginate(teams, page);

    const lines: string[] = [
      `┌─────────────────────────────`,
      `│ 🏷️ **Team List**`,
      `├─────────────────────────────`,
      `│ 📁 Project : ${context.project.name} (\`${context.project.slug}\`)`,
      `├─────────────────────────────`,
    ];

    for (const t of pageTeams) {
      const defaultTag = t.isDefault ? ' ⭐' : '';
      lines.push(`│ [#${t.id}]${defaultTag} **${t.name}**`);
      lines.push(`│      Slug   : \`${t.slug}\``);
      if (t.leader?.name) {
        lines.push(`│      Leader : ${t.leader.name}`);
      }
    }

    lines.push(`├─────────────────────────────`);
    lines.push(`│ ${buildPaginationFooter(meta, '*team list')}`);
    lines.push(`│ 💡 \`*team detail <id|slug>\` to view details`);
    lines.push(`└─────────────────────────────`);

    await this.reply(message, lines.join('\n'));
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
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*team create <slug> <name> [@leader]\``,
          `│ Example: \`*team create backend Backend Team @alice\``,
          `└─────────────────────────────`,
        ].join('\n'),
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
      await this.reply(message, '❌ Team name is required.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const dbUser = (ctx as any).dbUser;
    if (!dbUser || !this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can create teams.',
      );
      return;
    }

    let leaderId = context.user.id;
    let leaderName = dbUser.name ?? dbUser.mezonId;

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
          leaderName = leader.name ?? leader.mezonId;
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
      [
        `┌─────────────────────────────`,
        `│ ✅ **Team Created**`,
        `├─────────────────────────────`,
        `│ 📛  Name    : ${team.name}`,
        `│ 🔖  Slug    : \`${team.slug}\``,
        `│ 🆔  ID      : #${team.id}`,
        `│ 👤  Leader  : ${leaderName}`,
        `│ 📁  Project : ${context.project.name} (\`${context.project.slug}\`)`,
        `├─────────────────────────────`,
        `│ 💡 \`*team detail ${team.slug}\` to view details`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async detailTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*team detail <teamId|slug>`');
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
        `❌ Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    const defaultTag = team.isDefault ? 'Yes ⭐' : 'No';

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🏷️ **Team Detail**`,
        `├─────────────────────────────`,
        `│ 🆔  ID        : #${team.id}`,
        `│ 📛  Name      : ${team.name}`,
        `│ 🔖  Slug      : \`${team.slug}\``,
        `│ ⭐  Default   : ${defaultTag}`,
        `│ 👤  Leader    : ${team.leader?.name ?? '—'}`,
        `│ 📁  Project   : ${context.project.name} (\`${context.project.slug}\`)`,
        `│ 📅  Created   : ${this.formatDate(team.createdAt)}`,
        `│ 🔄  Updated   : ${this.formatDate(team.updatedAt)}`,
        `├─────────────────────────────`,
        `│ 💡 \`*team delete ${team.slug}\` to remove this team`,
        `└─────────────────────────────`,
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
      await this.reply(message, 'Usage: `*team delete <teamId|slug>`');
      return;
    }

    const dbUser = (ctx as any).dbUser;
    if (!dbUser || !this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can delete teams.',
      );
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
        `❌ Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Confirm Delete Team**`,
        `├─────────────────────────────`,
        `│ 📛  Name    : ${team.name}`,
        `│ 🔖  Slug    : \`${team.slug}\``,
        `│ 🆔  ID      : #${team.id}`,
        `│ 📁  Project : ${context.project.name} (\`${context.project.slug}\`)`,
        `├─────────────────────────────`,
        `│ ⚠️  This action **cannot be undone**.`,
        `│ Run to confirm:`,
        `│ \`*team confirm delete ${team.id}\``,
        `└─────────────────────────────`,
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
      await this.reply(message, 'Usage: `*team confirm delete <teamId|slug>`');
      return;
    }

    const dbUser = (ctx as any).dbUser;
    if (!dbUser || !this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can delete teams.',
      );
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
        `❌ Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    await this.teamService.deleteTeamFromProject(context.projectId, team.id);

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🗑️ **Team Deleted**`,
        `├─────────────────────────────`,
        `│ 📛  Name    : ${team.name}`,
        `│ 🔖  Slug    : \`${team.slug}\``,
        `│ 🆔  ID      : #${team.id}`,
        `│ 📁  Project : ${context.project.name} (\`${context.project.slug}\`)`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async restoreTeamCommand(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const slug = args[1];

    if (!slug) {
      await this.reply(message, 'Usage: `*team restore <slug>`');
      return;
    }

    const dbUser = (ctx as any).dbUser;
    if (!dbUser || !this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can restore teams.',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const restoredTeam = await this.teamService.restoreTeamBySlug(
      context.projectId,
      slug,
    );

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Team Restored**`,
        `├─────────────────────────────`,
        `│ 📛  Name    : ${restoredTeam.name}`,
        `│ 🔖  Slug    : \`${restoredTeam.slug}\``,
        `│ 🆔  ID      : #${restoredTeam.id}`,
        `│ 📁  Project : ${context.project.name} (\`${context.project.slug}\`)`,
        `├─────────────────────────────`,
        `│ 💡 \`*team detail ${restoredTeam.slug}\` to view details`,
        `└─────────────────────────────`,
      ].join('\n'),
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

  private isProjectManagerOrAdmin(dbUser: any): boolean {
    const userRole = Number(dbUser?.role);
    return userRole === UserRole.PM || userRole === UserRole.ADMIN;
  }

  private async setDefaultTeam(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const identifier = args[1];

    if (!identifier) {
      await this.reply(message, 'Usage: `*team default <teamId|slug>`');
      return;
    }

    const dbUser = (ctx as any).dbUser;
    if (!dbUser || !this.isProjectManagerOrAdmin(dbUser)) {
      await this.reply(
        message,
        '❌ Only **Administrators** and **Project Managers** can set the default team.',
      );
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
        `❌ Team **${identifier}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    await this.teamService.setDefaultTeam(context.projectId, team.id);

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ⭐ **Default Team Updated**`,
        `├─────────────────────────────`,
        `│ 📛  Name    : ${team.name}`,
        `│ 🔖  Slug    : \`${team.slug}\``,
        `│ 🆔  ID      : #${team.id}`,
        `│ 📁  Project : ${context.project.name} (\`${context.project.slug}\`)`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
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

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
