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
import { EventStatus } from './enums';
import { EventService } from './event.service';
import type EventEntity from './event.entity';

@Injectable()
@UseGuards(NezonAuthGuard)
export class EventCommandHandler {
  private readonly logger = new Logger(EventCommandHandler.name);

  constructor(
    private readonly eventService: EventService,
    private readonly projectContextService: ProjectContextService,
  ) {}

  @Command('event')
  async handleEventCommand(
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
          await this.listEvents(senderId, message);
          return;
        case 'create':
          await this.createEvent(args, senderId, message);
          return;
        case 'detail':
        case 'info':
          await this.showEvent(args, senderId, message);
          return;
        case 'cancel':
          await this.cancelEvent(args, senderId, message, ctx);
          return;
        default:
          await this.reply(
            message,
            [
              '📅 **Event Commands:**',
              '  `*event list` - List events in current project',
              '  `*event create <ISO-date> <title...>` - Create a scheduled event',
              '  `*event detail <id>` - View event detail',
              '  `*event cancel <id>` - Cancel an event',
            ].join('\n'),
          );
      }
    } catch (error) {
      this.logger.warn('Event command failed', (error as Error)?.stack);
      await this.reply(message, this.getErrorMessage(error));
    }
  }

  private async listEvents(
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const events = await this.eventService.listByProject(context.projectId);

    if (!events.length) {
      await this.reply(
        message,
        `No events found in project **${context.project.name}**.`,
      );
      return;
    }

    const lines = events.map((event) => {
      const startsAt = this.formatDate(event.startsAt);
      return `  [#${event.id}] ${event.title} - ${event.status} - ${startsAt}`;
    });

    await this.reply(
      message,
      [`📅 Events in **${context.project.name}**:`, ...lines].join('\n'),
    );
  }

  private async createEvent(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const startsAt = this.parseDate(args[1]);
    const title = args.slice(2).join(' ').trim();

    if (!startsAt || !title) {
      await this.reply(message, 'Usage: `*event create <ISO-date> <title...>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const event = await this.eventService.createEvent({
      description: null,
      endsAt: null,
      location: null,
      ownerUserId: context.user.id,
      projectId: context.projectId,
      startsAt,
      status: EventStatus.SCHEDULED,
      teamId: null,
      title,
    });

    await this.reply(
      message,
      `✅ Created event **#${event.id}: ${event.title}**.`,
    );
  }

  private async showEvent(
    args: string[],
    senderId: string,
    message: ManagedMessage,
  ): Promise<void> {
    const eventId = this.parseId(args[1]);

    if (eventId == null) {
      await this.reply(message, 'Usage: `*event detail <id>`');
      return;
    }

    const event = await this.getEventInCurrentProject(eventId, senderId);

    if (!event) {
      await this.reply(
        message,
        `Event #${eventId} not found in current project.`,
      );
      return;
    }

    await this.reply(
      message,
      [
        `**Event #${event.id}**`,
        `Title: ${event.title}`,
        `Status: ${event.status}`,
        `Starts: ${this.formatDate(event.startsAt)}`,
        `Ends: ${event.endsAt ? this.formatDate(event.endsAt) : 'N/A'}`,
        `Owner: ${event.ownerUserId}`,
        event.location ? `Location: ${event.location}` : null,
        event.description ? `Description: ${event.description}` : null,
      ]
        .filter((line): line is string => line != null)
        .join('\n'),
    );
  }

  private async cancelEvent(
    args: string[],
    senderId: string,
    message: ManagedMessage,
    ctx: NezonCommandContext,
  ): Promise<void> {
    const eventId = this.parseId(args[1]);

    if (eventId == null) {
      await this.reply(message, 'Usage: `*event cancel <id>`');
      return;
    }

    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    const event = await this.findEventInProject(eventId, context.projectId);

    if (!event) {
      await this.reply(
        message,
        `Event #${eventId} not found in current project.`,
      );
      return;
    }

    if (!this.canCancelEvent(event, context, ctx)) {
      await this.reply(
        message,
        'Only event owners, project owners, or administrators can cancel events.',
      );
      return;
    }

    const cancelled = await this.eventService.cancelEvent(eventId);

    if (!cancelled) {
      await this.reply(message, `Event #${eventId} not found.`);
      return;
    }

    await this.reply(message, `✅ Event #${cancelled.id} cancelled.`);
  }

  private async getEventInCurrentProject(
    eventId: number,
    senderId: string,
  ): Promise<EventEntity | null> {
    const context =
      await this.projectContextService.getRequiredCurrentProjectByMezonId(
        senderId,
      );
    return this.findEventInProject(eventId, context.projectId);
  }

  private async findEventInProject(
    eventId: number,
    projectId: number,
  ): Promise<EventEntity | null> {
    const event = await this.eventService.findById(eventId);

    if (!event || event.projectId !== projectId) {
      return null;
    }

    return event;
  }

  private canCancelEvent(
    event: EventEntity,
    context: { project: { ownerUserId: string }; user: { id: string } },
    ctx: NezonCommandContext,
  ): boolean {
    const dbUser = (ctx as any).dbUser;
    return (
      dbUser?.role === UserRole.PM ||
      context.project.ownerUserId === context.user.id ||
      event.ownerUserId === context.user.id
    );
  }

  private parseId(value: string | undefined): number | null {
    if (!value) {
      return null;
    }

    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private formatDate(value: Date): string {
    return value.toISOString();
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

    return 'Event command failed.';
  }

  private async reply(message: ManagedMessage, content: string): Promise<void> {
    await message.reply(SmartMessage.text(content));
  }
}
