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
import { TicketStatus } from './enums';
import { TicketService } from './ticket.service';

/**
 * Ticket command handler for the Mezon bot.
 *
 * *ticket list                         – List all tickets in current project
 * *ticket create <title>               – Create a new ticket
 * *ticket detail <ticketId>            – Get ticket detail
 * *ticket status <ticketId> <status>   – Update ticket status (open|in_progress|resolved|closed)
 * *ticket assign <ticketId> @mention   – Assign ticket to a user (via mention)
 * *ticket delete <ticketId>            – Soft-delete a ticket
 * *ticket resolve <ticketId>           – Mark ticket as resolved
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
    @Context() _ctx: NezonCommandContext,
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
          await this.listTickets(args, senderId, message);
          return;
        case 'create':
          await this.createTicket(args, senderId, message);
          return;
        case 'detail':
        case 'info':
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
          await this.resolveTicket(args, senderId, message);
          return;
        default:
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
    } catch (error) {
      this.logger.warn('Ticket command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listTickets(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    try {
      const page = Math.max(1, parseInt(args[1] ?? '1', 10) || 1);

      const context =
        await this.projectContextService.getRequiredCurrentProjectByMezonId(
          senderId,
        );

      let tickets = await this.ticketService.listByProject(context.projectId);

      if (!this.isProjectManagerOrAdmin(context.user)) {
        tickets = tickets.filter(
          (t) =>
            t.assigneeUserId === context.user.id ||
            t.reporterUserId === context.user.id,
        );
      }

      if (tickets.length === 0) {
        await this.reply(
          message,
          [
            `┌─────────────────────────────`,
            `│ 🎫 **Ticket List**`,
            `├─────────────────────────────`,
            `│ 📁 Project : ${context.project.name}`,
            `├─────────────────────────────`,
            `│ ℹ️  No tickets found in this project.`,
            `│ Use \`*ticket create <title>\` to create one.`,
            `└─────────────────────────────`,
          ].join('\n'),
        );
        return;
      }

      const STATUS_ICON: Record<string, string> = {
        [TicketStatus.OPEN]: '🟡',
        [TicketStatus.IN_PROGRESS]: '🔵',
        [TicketStatus.RESOLVED]: '✅',
        [TicketStatus.CLOSED]: '⬛',
      };

      const STATUS_ORDER: string[] = [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CLOSED,
      ];

      tickets.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
          a.id - b.id,
      );

      const { items: pageTickets, meta } = paginate(tickets, page);

      const lines: string[] = [
        `┌─────────────────────────────`,
        `│ 🎫 **Ticket List**`,
        `├─────────────────────────────`,
        `│ 📁 Project : ${context.project.name}`,
        `├─────────────────────────────`,
      ];

      for (const t of pageTickets) {
        const icon = STATUS_ICON[t.status] ?? '❓';
        const assignee = t.assigneeUser?.name ?? 'Unassigned';
        lines.push(`│ ${icon} **#${t.id}** ${t.title}`);
        lines.push(
          `│     👤 Assignee : ${assignee}  |  🔖 ${t.severity ?? 'unknown'}`,
        );
      }

      lines.push(`├─────────────────────────────`);
      lines.push(`│ ${buildPaginationFooter(meta, '*ticket list')}`);
      lines.push(`│ 💡 \`*ticket detail <id>\` to view details`);
      lines.push(`└─────────────────────────────`);

      await this.reply(message, lines.join('\n'));
    } catch (error) {
      this.logger.error('List tickets failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async createTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const raw = args.slice(1).join(' ').trim();

    if (!raw) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*ticket create <title> --desc <description>\``,
          `│ Example: \`*ticket create Login bug --desc Page crashes on submit\``,
          `│ \`*ticket create <title> [--desc <description>]\`  – Create a ticket`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    // Tách title và description qua flag --desc
    const descIndex = raw.indexOf('--desc');
    let title: string;
    let description: string | undefined;

    if (descIndex !== -1) {
      title = raw.slice(0, descIndex).trim();
      description = raw.slice(descIndex + 6).trim() || undefined;
    } else {
      title = raw;
    }

    if (!title) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Title is required**`,
          `├─────────────────────────────`,
          `│ Usage: \`*ticket create <title> [--desc <description>]\``,
          `└─────────────────────────────`,
        ].join('\n'),
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
      description,
    });

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ ✅ **Ticket Created**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${ticket.id}`,
        `│ 📝  Title    : ${ticket.title}`,
        `│ 🟡  Status   : ${ticket.status ?? TicketStatus.OPEN}`,
        `│ 👤  Reporter : ${context.user.name ?? senderId}`,
        `│ 📁  Project  : ${context.project.name}`,
        ticket.description
          ? `│ 📄  Desc     : ${ticket.description}`
          : `│ 📄  Desc     : —`,
        `├─────────────────────────────`,
        `│ 💡 \`*ticket assign ${ticket.id} @user\` to assign`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async detailTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = this.parseId(args[1]);

    if (ticketId == null) {
      await this.reply(message, 'Usage: `*ticket detail <id>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    const ticket = await this.ticketService.getTicketById(
      context.projectId,
      ticketId,
    );

    if (!ticket) {
      await this.reply(
        message,
        `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
      );
      return;
    }

    if (
      !this.hasTicketPermission(context.user, {
        reporterUserId: ticket.reporterUserId,
        assigneeUserId: ticket.assigneeUserId,
      })
    ) {
      await this.reply(
        message,
        `❌ You don't have permission to view this ticket.`,
      );
      return;
    }

    const STATUS_ICON: Record<string, string> = {
      [TicketStatus.OPEN]: '🟡',
      [TicketStatus.IN_PROGRESS]: '🔵',
      [TicketStatus.RESOLVED]: '✅',
      [TicketStatus.CLOSED]: '⬛',
    };

    const SEVERITY_ICON: Record<string, string> = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴',
    };

    const statusIcon = STATUS_ICON[ticket.status] ?? '❓';
    const severityIcon =
      SEVERITY_ICON[String(ticket.severity).toLowerCase()] ?? '❔';

    await this.reply(
      message,
      [
        `┌─────────────────────────────`,
        `│ 🎫 **Ticket Detail**`,
        `├─────────────────────────────`,
        `│ 🆔  ID       : #${ticket.id}`,
        `│ 📝  Title    : ${ticket.title}`,
        `│ ${statusIcon}  Status   : ${ticket.status ?? TicketStatus.OPEN}`,
        `│ ${severityIcon}  Severity : ${ticket.severity ?? '—'}`,
        `│ 👤  Assignee : ${ticket.assigneeUser?.name ?? 'Unassigned'}`,
        `│ 📝  Reporter : ${ticket.reporterUser?.name ?? '—'}`,
        `│ 📁  Project  : ${context.project.name}`,
        ticket.description
          ? `│ 📄  Desc     : ${ticket.description}`
          : `│ 📄  Desc     : —`,
        `├─────────────────────────────`,
        `│ 💡 \`*ticket status ${ticket.id} <status>\` to update`,
        `└─────────────────────────────`,
      ].join('\n'),
    );
  }

  private async updateTicketStatus(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    try {
      const ticketId = Number(args[1]);
      const rawStatus = args[2];
      const normalizedStatus = rawStatus
        ? String(rawStatus).trim().toUpperCase()
        : undefined;

      const validStatuses = Object.values(TicketStatus) as string[];

      if (!ticketId || !rawStatus || !normalizedStatus) {
        await this.reply(
          message,
          [
            `┌─────────────────────────────`,
            `│ ❌ **Missing required fields**`,
            `├─────────────────────────────`,
            `│ Usage: \`*ticket status <id> <status>\``,
            `│ Valid : \`${validStatuses.join(' | ')}\``,
            `└─────────────────────────────`,
          ].join('\n'),
        );
        return;
      }

      if (!validStatuses.includes(normalizedStatus)) {
        await this.reply(
          message,
          [
            `┌─────────────────────────────`,
            `│ ❌ **Unknown status:** \`${rawStatus}\``,
            `├─────────────────────────────`,
            `│ Valid : \`${validStatuses.join(' | ')}\``,
            `└─────────────────────────────`,
          ].join('\n'),
        );
        return;
      }

      const context =
        await this.projectContextService.getRequiredCurrentProjectByMezonId(
          senderId,
        );

      const ticket = await this.ticketService.getTicketById(
        context.projectId,
        ticketId,
      );

      if (!ticket) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      if (
        !this.hasTicketPermission(context.user, {
          reporterUserId: ticket.reporterUserId,
          assigneeUserId: ticket.assigneeUserId,
        })
      ) {
        await this.reply(
          message,
          `❌ You don't have permission to update this ticket.`,
        );
        return;
      }

      const updated = await this.ticketService.updateStatus(
        context.projectId,
        ticketId,
        normalizedStatus as TicketStatus,
      );

      const STATUS_ICON: Record<string, string> = {
        [TicketStatus.OPEN]: '🟡',
        [TicketStatus.IN_PROGRESS]: '🔵',
        [TicketStatus.RESOLVED]: '✅',
        [TicketStatus.CLOSED]: '⬛',
      };

      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ✅ **Status Updated**`,
          `├─────────────────────────────`,
          `│ 🆔  Ticket  : #${updated.id} — ${updated.title}`,
          `│ ${STATUS_ICON[updated.status] ?? '❓'}  Status  : ${updated.status}`,
          `│ 📁  Project : ${context.project.name}`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error('Update ticket status failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async assignTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const ticketId = Number(args[1]);
    const mentionArg = args[2];

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );

    if (!this.isProjectManagerOrAdmin(context.user)) {
      await this.reply(message, `❌ Only **PM / Admin** can assign tickets.`);
      return;
    }

    if (Number.isNaN(ticketId) || !mentionArg) {
      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ❌ **Missing required fields**`,
          `├─────────────────────────────`,
          `│ Usage: \`*ticket assign <id> @mention\``,
          `│ Example: \`*ticket assign 12 @Bao\``,
          `└─────────────────────────────`,
        ].join('\n'),
      );
      return;
    }

    const targetIdentifier =
      this.getMentionedUserIdentifier(mentionArg, message) ||
      mentionArg.replace(/^@/, '').trim();

    const assigneeUser = await this.userService.findByIdentifier(
      targetIdentifier,
      false,
    );

    if (!assigneeUser) {
      await this.reply(
        message,
        `❌ User **"${mentionArg}"** not found or has been removed from the system.`,
      );
      return;
    }

    try {
      const updatedTicket = await this.ticketService.updateTicket(
        context.projectId,
        ticketId,
        { assigneeUserId: assigneeUser.id },
      );

      if (!updatedTicket) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ✅ **Ticket Assigned**`,
          `├─────────────────────────────`,
          `│ 🆔  Ticket  : #${updatedTicket.id} — ${updatedTicket.title}`,
          `│ 👤  Assignee: ${assigneeUser.name ?? assigneeUser.mezonId}`,
          `│ 📁  Project : ${context.project.name}`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.warn('Failed to assign ticket', (error as Error)?.stack);
      await this.reply(message, `❌ ${this.getErrorMessage(error)}`);
    }
  }

  private async deleteTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    try {
      const ticketId = this.parseId(args[1]);

      if (ticketId == null) {
        await this.reply(message, 'Usage: `*ticket delete <id>`');
        return;
      }

      const context =
        await this.projectContextService.getRequiredCurrentProjectByMezonId(
          senderId,
        );

      if (!this.isProjectManagerOrAdmin(context.user)) {
        await this.reply(message, `❌ Only **PM / Admin** can delete tickets.`);
        return;
      }

      const ticket = await this.ticketService.getTicketById(
        context.projectId,
        ticketId,
      );

      if (!ticket) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ 🗑️ **Confirm Delete Ticket**`,
          `├─────────────────────────────`,
          `│ 🆔  ID    : #${ticket.id}`,
          `│ 📝  Title : ${ticket.title}`,
          `│ 📁  Project : ${context.project.name}`,
          `├─────────────────────────────`,
          `│ ⚠️  This action **cannot be undone**.`,
          `│ Run to confirm:`,
          `│ \`*ticket confirm delete ${ticket.id}\``,
          `└─────────────────────────────`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error('Delete ticket failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async confirmDeleteTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    try {
      const ticketId = this.parseId(args[2]);

      if (ticketId == null) {
        await this.reply(message, 'Usage: `*ticket confirm delete <id>`');
        return;
      }

      const context =
        await this.projectContextService.getRequiredCurrentProjectByMezonId(
          senderId,
        );

      if (!this.isProjectManagerOrAdmin(context.user)) {
        await this.reply(message, `❌ Only **PM / Admin** can delete tickets.`);
        return;
      }

      const ticket = await this.ticketService.getTicketById(
        context.projectId,
        ticketId,
      );

      if (!ticket) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      await this.ticketService.deleteTicket(context.projectId, ticketId);

      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ 🗑️ **Ticket Deleted**`,
          `├─────────────────────────────`,
          `│ 🆔  ID    : #${ticket.id}`,
          `│ 📝  Title : ${ticket.title}`,
          `│ 📁  Project : ${context.project.name}`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error(
        'Confirm delete ticket failed',
        (error as Error)?.stack,
      );
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async resolveTicket(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    try {
      const ticketId = this.parseId(args[1]);

      if (ticketId == null) {
        await this.reply(message, 'Usage: `*ticket resolve <id>`');
        return;
      }

      const context =
        await this.projectContextService.getRequiredCurrentProjectByMezonId(
          senderId,
        );

      const ticket = await this.ticketService.getTicketById(
        context.projectId,
        ticketId,
      );

      if (!ticket) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      if (
        !this.hasTicketPermission(context.user, {
          reporterUserId: ticket.reporterUserId,
          assigneeUserId: ticket.assigneeUserId,
        })
      ) {
        await this.reply(
          message,
          `❌ You don't have permission to resolve this ticket.`,
        );
        return;
      }

      const updated = await this.ticketService.updateTicket(
        context.projectId,
        ticketId,
        { status: TicketStatus.RESOLVED },
      );

      if (!updated) {
        await this.reply(
          message,
          `❌ Ticket **#${ticketId}** not found in project **${context.project.name}**.`,
        );
        return;
      }

      await this.reply(
        message,
        [
          `┌─────────────────────────────`,
          `│ ✅ **Ticket Resolved**`,
          `├─────────────────────────────`,
          `│ 🆔  ID      : #${updated.id}`,
          `│ 📝  Title   : ${updated.title}`,
          `│ 📁  Project : ${context.project.name}`,
          `└─────────────────────────────`,
        ].join('\n'),
      );
    } catch (error) {
      this.logger.error('Resolve ticket failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────
  private isProjectManagerOrAdmin(
    dbUser: { role?: unknown } | null | undefined,
  ): boolean {
    const role = Number(dbUser?.role);
    return role === UserRole.PM || role === UserRole.ADMIN;
  }

  private hasTicketPermission(
    dbUser: { id?: unknown; role?: unknown } | null | undefined,
    ticket: { reporterUserId: string; assigneeUserId: string | null },
  ): boolean {
    if (!dbUser?.id) return false;

    const userId = String(dbUser.id);

    const isAssignee =
      ticket.assigneeUserId != null && ticket.assigneeUserId === userId;
    const isReporter = ticket.reporterUserId === userId;

    return this.isProjectManagerOrAdmin(dbUser) || isAssignee || isReporter;
  }

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
