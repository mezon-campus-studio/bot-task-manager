import { UserRole } from '#src/common/enums/index.js';
import { TicketCommandHandler } from './ticket-command.handler';

describe(TicketCommandHandler.name, () => {
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
      raw: {
        content: {
          t: '*ticket assign 1 @MCS01_bao.vohoang',
        },
        mentions: [
          {
            user_id: 'mezon-target-1',
            username: 'MCS01_bao.vohoang',
          },
        ],
      },
      reply: jest.fn().mockResolvedValue(undefined),
      senderId,
    } as never;
  }

  function createHandler(overrides?: {
    projectContextService?: Partial<Record<string, jest.Mock>>;
    ticketService?: Partial<Record<string, jest.Mock>>;
    userService?: Partial<Record<string, jest.Mock>>;
  }) {
    const context = {
      project: { id: 7, name: 'Campus Core', slug: 'campus-core' },
      projectId: 7,
      user: {
        id: 'user-1',
        mezonId: 'mezon-user-1',
        name: 'Reporter',
        role: UserRole.PM,
      },
    };
    const projectContextService = {
      getRequiredCurrentProjectByMezonId: jest.fn().mockResolvedValue(context),
      ...overrides?.projectContextService,
    };
    const ticketService = {
      deleteTicket: jest.fn(),
      getTicketById: jest.fn(),
      updateTicket: jest.fn(),
      ...overrides?.ticketService,
    };
    const userService = {
      findByIdentifier: jest.fn(),
      ...overrides?.userService,
    };

    return {
      context,
      handler: new TicketCommandHandler(
        ticketService as never,
        projectContextService as never,
        userService as never,
      ),
      projectContextService,
      ticketService,
      userService,
    };
  }

  it('assigns a ticket to a resolved mention user', async () => {
    const message = createMessage();
    const { handler, ticketService, userService } = createHandler({
      ticketService: {
        updateTicket: jest.fn().mockResolvedValue({
          assigneeUserId: 'user-2',
          id: 1,
          title: 'Resolve ticket',
        }),
      },
      userService: {
        findByIdentifier: jest.fn().mockResolvedValue({
          id: 'user-2',
          mezonId: 'mezon-target-1',
          name: 'Bao',
        }),
      },
    });

    await handler.handleTicketCommand(
      ['assign', '1', '@MCS01_bao.vohoang'],
      message,
      {} as never,
    );

    expect(userService.findByIdentifier).toHaveBeenCalledWith(
      'mezon-target-1',
      false,
    );
    expect(ticketService.updateTicket).toHaveBeenCalledWith(7, 1, {
      assigneeUserId: 'user-2',
    });
    expectReplyText(message as never, 'Assignee: Bao');
  });

  it('prepares ticket deletion and requires a confirmation command', async () => {
    const message = createMessage();
    const { handler, ticketService } = createHandler({
      ticketService: {
        getTicketById: jest.fn().mockResolvedValue({
          id: 1,
          projectId: 7,
          title: 'Resolve ticket',
        }),
      },
    });

    await handler.handleTicketCommand(['delete', '1'], message, {} as never);

    expect(ticketService.deleteTicket).not.toHaveBeenCalled();
    expectReplyText(message as never, '*ticket confirm delete 1');
  });

  it('deletes a ticket only after confirm delete', async () => {
    const message = createMessage();
    const { handler, ticketService } = createHandler({
      ticketService: {
        deleteTicket: jest.fn().mockResolvedValue(true),
        getTicketById: jest.fn().mockResolvedValue({
          id: 1,
          projectId: 7,
          title: 'Resolve ticket',
        }),
      },
    });

    await handler.handleTicketCommand(
      ['confirm', 'delete', '1'],
      message,
      {} as never,
    );

    expect(ticketService.deleteTicket).toHaveBeenCalledWith(7, 1);
    expectReplyText(message as never, '**Ticket Deleted**');
  });
});
