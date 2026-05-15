import { UserRole } from '@src/common/enums/user.enum';
import { EventStatus } from './enums';
import { EventCommandHandler } from './event-command.handler';

describe(EventCommandHandler.name, () => {
  function expectReplyText(message: { reply: jest.Mock }, text: string): void {
    expect(message.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          t: expect.stringContaining(text),
        }),
      }),
    );
  }

  function createMessage(senderId = 'mezon-user-1') {
    return {
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: {
    eventService?: Partial<Record<string, jest.Mock>>;
    projectContextService?: Partial<Record<string, jest.Mock>>;
  }) {
    const context = {
      project: {
        id: 7,
        name: 'Campus Core',
        ownerUserId: 'owner-user-id',
        slug: 'campus-core',
      },
      projectId: 7,
      user: {
        id: 'user-1',
        mezonId: 'mezon-user-1',
        name: 'Planner',
        role: UserRole.DEV,
      },
    };
    const eventService = {
      cancelEvent: jest.fn(),
      createEvent: jest.fn(),
      findById: jest.fn(),
      listByProject: jest.fn(),
      ...overrides?.eventService,
    };
    const projectContextService = {
      getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue(context),
      ...overrides?.projectContextService,
    };

    return {
      context,
      eventService,
      handler: new EventCommandHandler(
        eventService as never,
        projectContextService as never,
      ),
      projectContextService,
    };
  }

  it('lists events in the current project', async () => {
    const message = createMessage();
    const { eventService, handler } = createHandler({
      eventService: {
        listByProject: jest.fn().mockResolvedValue([
          {
            id: 3,
            startsAt: new Date('2026-06-01T09:00:00.000Z'),
            status: EventStatus.SCHEDULED,
            title: 'Sprint planning',
          },
        ]),
      },
    });

    await handler.handleEventCommand(['list'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expect(eventService.listByProject).toHaveBeenCalledWith(7);
    expectReplyText(message as never, '[#3] Sprint planning');
  });

  it('creates a scheduled event owned by the current user', async () => {
    const message = createMessage();
    const startsAt = '2026-06-01T09:00:00Z';
    const { eventService, handler } = createHandler({
      eventService: {
        createEvent: jest.fn().mockResolvedValue({
          id: 4,
          title: 'Sprint planning',
        }),
      },
    });

    await handler.handleEventCommand(
      ['create', startsAt, 'Sprint', 'planning'],
      message,
      { dbUser: { role: UserRole.DEV } } as never,
    );

    expect(eventService.createEvent).toHaveBeenCalledWith({
      description: null,
      endsAt: null,
      location: null,
      ownerUserId: 'user-1',
      projectId: 7,
      startsAt: new Date(startsAt),
      status: EventStatus.SCHEDULED,
      teamId: null,
      title: 'Sprint planning',
    });
    expectReplyText(message as never, 'Created event **#4: Sprint planning**');
  });

  it('does not show an event from another project', async () => {
    const message = createMessage();
    const { handler } = createHandler({
      eventService: {
        findById: jest.fn().mockResolvedValue({
          id: 4,
          projectId: 99,
          title: 'Other project event',
        }),
      },
    });

    await handler.handleEventCommand(['detail', '4'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expectReplyText(message as never, 'Event #4 not found in current project.');
  });

  it('lets the event owner cancel an event in the current project', async () => {
    const message = createMessage();
    const { eventService, handler } = createHandler({
      eventService: {
        cancelEvent: jest.fn().mockResolvedValue({
          id: 4,
          status: EventStatus.CANCELLED,
          title: 'Sprint planning',
        }),
        findById: jest.fn().mockResolvedValue({
          id: 4,
          ownerUserId: 'user-1',
          projectId: 7,
          title: 'Sprint planning',
        }),
      },
    });

    await handler.handleEventCommand(['cancel', '4'], message, {
      dbUser: { role: UserRole.DEV },
    } as never);

    expect(eventService.cancelEvent).toHaveBeenCalledWith(4);
    expectReplyText(message as never, 'cancelled');
  });
});
