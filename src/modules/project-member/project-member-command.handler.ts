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
import { ProjectMemberService } from './project-member.service';

@Injectable()
@UseGuards(NezonAuthGuard)
export class ProjectMemberCommandHandler {
  private readonly logger = new Logger(ProjectMemberCommandHandler.name);

  constructor(
    private readonly projectMemberService: ProjectMemberService,
    private readonly projectContextService: ProjectContextService,
    private readonly userService: UserService,
  ) {}

  @Command({ name: 'project-member', aliases: ['project-members'] })
  async handleProjectMemberCommand(
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
          await this.listMembers(senderId, message);
          return;
        case 'invite':
        case 'add':
          await this.inviteMember(args, senderId, message, ctx);
          return;
        case 'remove':
        case 'delete':
          await this.removeMember(args, senderId, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              '👥 **Project Member Commands:**',
              '  `*project-member list` - List members in current project',
              '  `*project-member invite <userId|@username>` - Invite a user to current project',
              '  `*project-member remove <userId|@username>` - Remove a user from current project',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn(
        'Project member command failed',
        (error as Error)?.stack,
      );
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listMembers(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const members = await this.projectMemberService.listByProject(
      context.projectId,
    );

    if (!members.length) {
      await this.reply(
        message,
        `No project members found in **${context.project.name}**.`,
      );
      return;
    }

    const lines = members.map((member, index) => {
      const displayName =
        member.user?.name ?? member.user?.mezonId ?? member.userId;
      return `  ${index + 1}. ${displayName} - ${member.status}`;
    });

    await this.reply(
      message,
      [`👥 Members in **${context.project.name}**:`, ...lines].join('\n'),
    );
  }

  private async inviteMember(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const rawIdentifier = args[1];

    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*project-member invite <userId|@username>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.canManageProjectMembers(context, ctx)) {
      await this.reply(
        message,
        'Only project owners or administrators can manage project members.',
      );
      return;
    }

    const targetUser = await this.findTargetUser(rawIdentifier, message);

    if (!targetUser) {
      await this.reply(message, `User **${rawIdentifier}** not found.`);
      return;
    }

    const membership = await this.projectMemberService.inviteProjectMember({
      invitedByUserId: context.user.id,
      projectId: context.projectId,
      userId: targetUser.id,
    });

    await this.reply(
      message,
      `✅ Invited **${targetUser.name ?? targetUser.mezonId}** to **${context.project.name}** (${membership.status}).`,
    );
  }

  private async removeMember(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const rawIdentifier = args[1];

    if (!rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*project-member remove <userId|@username>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.canManageProjectMembers(context, ctx)) {
      await this.reply(
        message,
        'Only project owners or administrators can manage project members.',
      );
      return;
    }

    const targetUser = await this.findTargetUser(rawIdentifier, message);

    if (!targetUser) {
      await this.reply(message, `User **${rawIdentifier}** not found.`);
      return;
    }

    const removed = await this.projectMemberService.removeProjectMember(
      context.projectId,
      targetUser.id,
    );

    if (!removed) {
      await this.reply(
        message,
        `Project member **${targetUser.name ?? targetUser.mezonId}** was not active in **${context.project.name}**.`,
      );
      return;
    }

    await this.reply(
      message,
      `🗑️ Removed **${targetUser.name ?? targetUser.mezonId}** from **${context.project.name}**.`,
    );
  }

  private async findTargetUser(rawIdentifier: string, message: ManagedMessage) {
    const identifier =
      this.getMentionedUserIdentifier(rawIdentifier, message) ??
      rawIdentifier.replace(/^@/, '').trim();
    return this.userService.findByIdentifier(identifier);
  }

  private canManageProjectMembers(
    context: { project: { ownerUserId: string }; user: { id: string } },
    ctx: NezonCommandContext,
  ): boolean {
    const dbUser = (ctx as any).dbUser;
    return (
      dbUser?.role === UserRole.PM ||
      context.project.ownerUserId === context.user.id
    );
  }

  private getMentionedUserIdentifier(
    identifier: string,
    message: ManagedMessage,
  ): string | null {
    const normalized = identifier.trim();
    if (!normalized.startsWith('@')) {
      return null;
    }

    const mentionName = normalized.slice(1).trim().toLowerCase();
    if (!mentionName) {
      return null;
    }

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

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (
        response != null &&
        typeof response === 'object' &&
        'message' in response
      ) {
        const message = response.message;
        if (Array.isArray(message)) return message.join(', ');
        if (typeof message === 'string') return message;
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Project member command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
