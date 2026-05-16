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
import { TicketStatus } from './enums';
import { TicketService } from './ticket.service';

/**
 * Ticket command handler for the Mezon bot.
 *
 *   *ticket list                         – List all tickets in current project
 *   *ticket create <title>               – Create a new ticket
 *   *ticket detail <ticketId>            – Get ticket detail
 *   *ticket status <ticketId> <status>   – Update ticket status (open|in_progress|resolved|closed)
 *   *ticket assign <ticketId> @mention   – Assign ticket to a user (via mention)
 *   *ticket delete <ticketId>            – Soft-delete a ticket
 *   *ticket resolve <ticketId>           – Mark ticket as resolved
 */
@Injectable()
@UseGuards(NezonAuthGuard)
export class TicketCommandHandler {
  private readonly logger = new Logger(TicketCommandHandler.name);

  constructor(
    private readonly ticketService: TicketService,
    private readonly projectContextService: ProjectContextService,
    private readonly userService: UserService,
  ) {}

  @Command('ticket')
  async handleTicketCommand(
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
          await this.listTickets(senderId, message);
          return;
        case 'create':
          await this.createTicket(args, senderId, message);
          return;
        case 'detail':
          await this.detailTicket(args, senderId, message);
          return;
        case 'status':
          await this.updateTicketStatus(args, senderId, message);
          return;
        case 'assign':
          await this.assignTicket(args, senderId, message);
          return;
        case 'delete':
          await this.deleteTicket(args, senderId, message);
          return;
        case 'confirm':
          if (args[1]?.toLowerCase() === 'delete') {
            await this.confirmDeleteTicket(args, senderId, message);
            return;
          }
          await this.reply(message, 'Usage: `*ticket confirm delete <id>`');
          return;
        case 'resolve':
          await this.resolveTicket(args, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              '📋 **Ticket Commands:**',
              '  `*ticket list` – List tickets in current project',
              '  `*ticket create <title>` – Create a ticket',
              '  `*ticket detail <id>` – View ticket detail',
              '  `*ticket status <id> <open|in_progress|resolved|closed>` – Update status',
              '  `*ticket assign <id> <userId|@username>` – Assign ticket to user',
              '  `*ticket resolve <id>` – Mark ticket as resolved',
              '  `*ticket delete <id>` – Prepare delete confirmation',
              '  `*ticket confirm delete <id>` – Confirm ticket deletion',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Ticket command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listTickets(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const tickets = await this.ticketService.listByProject(context.projectId);

    if (!tickets.length) {
      await this.reply(
        message,
        `No tickets found in project **${context.project.name}**.`,
      );
      return;
    }

    const lines = tickets.map(
      (t) => `  [#${t.id}] ${t.title} — ${t.status ?? 'open'}`,
    );

    await this.reply(
      message,
      [`📋 Tickets in **${context.project.name}**:`, ...lines].join('\n'),
    );
  }

  private async createTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const title = args.slice(1).join(' ').trim();

    if (!title) {
      await this.reply(
        message,
        'Ticket title is required.\nUsage: `*ticket create <title>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.createTicket({
      projectId: context.projectId,
      reporterUserId: context.user.id,
      title,
    });

    await this.reply(
      message,
      `✅ Created ticket **#${ticket.id}: ${ticket.title}** in project **${context.project.name}**.`,
    );
  }

  private async detailTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);

    if (ticketId == null) {
      await this.reply(
        message,
        'Valid ticket ID is required.\nUsage: `*ticket detail <id>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.getDetailTicket(
      context.projectId,
      ticketId,
    );

    if (!ticket) {
      await this.reply(
        message,
        `Ticket #${ticketId} not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `📄 **Ticket #${ticket.id}**`,
        `  Title: ${ticket.title}`,
        `  Status: ${ticket.status ?? 'open'}`,
        `  Severity: ${ticket.severity ?? 'unknown'}`,
        `  Assignee: ${ticket.assigneeUserId ?? 'unassigned'}`,
        `  Reporter: ${ticket.reporterUserId}`,
      ].join('\n'),
    );
  }

  private async updateTicketStatus(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);
    const rawStatus = args[2]?.trim();
    const status = rawStatus?.toUpperCase() as TicketStatus | undefined;

    if (ticketId == null || !status) {
      await this.reply(
        message,
        'Usage: `*ticket status <id> <open|in_progress|resolved|closed>`',
      );
      return;
    }

    const validStatuses = Object.values(TicketStatus) as string[];
    if (!validStatuses.includes(status)) {
      await this.reply(
        message,
        `Invalid status. Valid values: ${validStatuses.join(', ')}`,
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.updateTicket(
      context.projectId,
      ticketId,
      { status },
    );

    if (!ticket) {
      await this.reply(message, `Ticket #${ticketId} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Ticket **#${ticket.id}** status updated to **${ticket.status}**.`,
    );
  }

  private async assignTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);
    const rawIdentifier = args[2];

    if (ticketId == null || !rawIdentifier) {
      await this.reply(
        message,
        'Usage: `*ticket assign <id> <userId|@username>`',
      );
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const targetIdentifier =
      this.getMentionedUserIdentifier(rawIdentifier, message) ??
      rawIdentifier.replace(/^@/, '').trim();
    const targetUser =
      await this.userService.findByIdentifier(targetIdentifier);

    if (!targetUser) {
      await this.reply(message, `User **${rawIdentifier}** not found.`);
      return;
    }

    const ticket = await this.ticketService.updateTicket(
      context.projectId,
      ticketId,
      { assigneeUserId: targetUser.id },
    );

    if (!ticket) {
      await this.reply(message, `Ticket #${ticketId} not found.`);
      return;
    }

    await this.reply(
      message,
      `✅ Ticket **#${ticket.id}** assigned to **${targetUser.name ?? targetUser.mezonId}**.`,
    );
  }

  private async deleteTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);

    if (ticketId == null) {
      await this.reply(message, 'Usage: `*ticket delete <id>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.getDetailTicket(
      context.projectId,
      ticketId,
    );

    if (!ticket) {
      await this.reply(
        message,
        `Ticket #${ticketId} not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `🗑️ Are you sure you want to delete ticket **#${ticket.id}: ${ticket.title}**?`,
        `Run: \`*ticket confirm delete ${ticket.id}\` to complete the deletion.`,
      ].join('\n'),
    );
  }

  private async confirmDeleteTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[2]);

    if (ticketId == null) {
      await this.reply(message, 'Usage: `*ticket confirm delete <id>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.getDetailTicket(
      context.projectId,
      ticketId,
    );

    if (!ticket) {
      await this.reply(
        message,
        `Ticket #${ticketId} not found in current project.`,
      );
      return;
    }

    const deleted = await this.ticketService.deleteTicket(
      context.projectId,
      ticketId,
    );

    if (!deleted) {
      await this.reply(message, `Ticket #${ticketId} not found.`);
      return;
    }

    await this.reply(message, `🗑️ Ticket **#${ticketId}** has been deleted.`);
  }

  private async resolveTicket(
    args: string[],
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);

    if (ticketId == null) {
      await this.reply(message, 'Usage: `*ticket resolve <id>`');
      return;
    }

    const dbUser = (ctx as any).dbUser;
    if (
      !dbUser ||
      (Number(dbUser.role) !== UserRole.PM &&
        Number(dbUser.role) !== UserRole.ADMIN)
    ) {
      await this.reply(
        message,
        '❌ Only project managers and administrators can resolve tickets.',
      );
      return;
    }

    const senderId = message.senderId;
    if (!senderId) {
      await this.reply(message, 'Cannot resolve command sender.');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.updateTicket(
      context.projectId,
      ticketId,
      {
        status: TicketStatus.RESOLVED,
      },
    );

    if (!ticket) {
      await this.reply(
        message,
        `Ticket #${ticketId} not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      `✅ Ticket **#${ticket.id}: ${ticket.title}** has been marked as resolved.`,
    );
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private parseId(value: string | undefined): number | null {
    if (!value) return null;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
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
        .map((itemValue: any) => String(itemValue).trim().toLowerCase())
        .map((itemValue: string) =>
          itemValue.startsWith('@') ? itemValue.slice(1) : itemValue,
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
        const msg = (response as any).message;
        if (Array.isArray(msg)) return msg.join(', ');
        if (typeof msg === 'string') return msg;
      }
    }
    return 'Ticket command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
