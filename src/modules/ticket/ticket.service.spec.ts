import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { TicketSeverity, TicketStatus } from './enums';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';

describe(TicketService.name, () => {
  let ticketService: TicketService;
  let ticketRepository: Repository<TicketEntity>;
  let numericSequence = 0;

  beforeAll(createTestingModule);

  beforeAll(() => {
    ticketService = testingModule!.get(TicketService);
    ticketRepository = testingModule!
      .get(DataSource)
      .getRepository(TicketEntity);
  });

  function nextNumericId() {
    numericSequence += 1;
    return numericSequence;
  }

  function createTicketContext() {
    return {
      assigneeUserId: randomUUID(),
      projectId: nextNumericId(),
      reporterUserId: randomUUID(),
      teamId: nextNumericId(),
    };
  }

  it('should create a ticket for the active project support queue', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      createTicketContext();

    const ticket = await ticketService.createTicket({
      assigneeUserId,
      description: 'A student cannot join the private campus workspace.',
      projectId,
      reporterUserId,
      severity: TicketSeverity.HIGH,
      status: TicketStatus.OPEN,
      teamId,
      title: 'Workspace access issue',
    });

    expect(ticket).toMatchObject({
      assigneeUserId,
      description: 'A student cannot join the private campus workspace.',
      id: expect.any(Number),
      projectId,
      reporterUserId,
      severity: TicketSeverity.HIGH,
      status: TicketStatus.OPEN,
      teamId,
      title: 'Workspace access issue',
    });

    await expect(
      ticketRepository.findOneByOrFail({ id: ticket.id }),
    ).resolves.toMatchObject({
      assigneeUserId,
      id: ticket.id,
      projectId,
      reporterUserId,
      severity: TicketSeverity.HIGH,
      status: TicketStatus.OPEN,
      teamId,
      title: 'Workspace access issue',
    });
  });

  it('should return only project tickets in newest-first order', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      createTicketContext();
    const otherProjectId = nextNumericId();

    const olderTicket = await factory.ticket({
      assigneeUserId,
      projectId,
      reporterUserId,
      teamId,
      title: 'Student role is missing',
    });
    const newerTicket = await factory.ticket({
      assigneeUserId,
      projectId,
      reporterUserId,
      teamId,
      title: 'Notification channel is archived',
    });

    await factory.ticket({
      projectId: otherProjectId,
      reporterUserId: randomUUID(),
      teamId: nextNumericId(),
      title: 'Ignore other project ticket',
    });

    const tickets = await ticketService.listByProject(projectId);

    expect(tickets).toHaveLength(2);
    expect(tickets.map(({ id }) => id)).toEqual([
      newerTicket.id,
      olderTicket.id,
    ]);
    expect(tickets.every((ticket) => ticket.projectId === projectId)).toBe(
      true,
    );
  });

  it('should mark an existing ticket as resolved after the support fix lands', async () => {
    const { assigneeUserId, projectId, reporterUserId, teamId } =
      createTicketContext();
    const ticket = await factory.ticket({
      assigneeUserId,
      projectId,
      reporterUserId,
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
      teamId,
      title: 'Advisor sync webhook failed',
    });

    const resolvedTicket = await ticketService.markResolved(
      projectId,
      ticket.id,
    );

    expect(resolvedTicket).toMatchObject({
      id: ticket.id,
      status: TicketStatus.RESOLVED,
    });

    await expect(
      ticketRepository.findOneByOrFail({ id: ticket.id }),
    ).resolves.toMatchObject({
      id: ticket.id,
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.RESOLVED,
    });
  });

  it('should return null when the ticket to resolve does not exist', async () => {
    await expect(
      ticketService.markResolved(nextNumericId(), 999_999),
    ).resolves.toBeNull();
    await expect(ticketRepository.count()).resolves.toBe(0);
  });

  it('should return a ticket when getDetailTicket finds a match within the project', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const ticket = await factory.ticket({
      projectId,
      reporterUserId,
      teamId,
      title: 'Detail lookup ticket',
    });

    const found = await ticketService.getTicketById(projectId, ticket.id);

    expect(found).toMatchObject({
      id: ticket.id,
      projectId,
      title: 'Detail lookup ticket',
    });
  });

  it('should return null from getDetailTicket when the ticket belongs to a different project', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const otherProjectId = nextNumericId();
    const ticket = await factory.ticket({
      projectId,
      reporterUserId,
      teamId,
      title: 'Wrong project ticket',
    });

    await expect(
      ticketService.getTicketById(otherProjectId, ticket.id),
    ).resolves.toBeNull();
  });

  it('should update ticket fields and persist the changes', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const ticket = await factory.ticket({
      projectId,
      reporterUserId,
      severity: TicketSeverity.LOW,
      status: TicketStatus.OPEN,
      teamId,
      title: 'Original title',
    });

    const updated = await ticketService.updateTicket(projectId, ticket.id, {
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
      title: 'Updated title',
    });

    expect(updated).toMatchObject({
      id: ticket.id,
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
      title: 'Updated title',
    });

    await expect(
      ticketRepository.findOneByOrFail({ id: ticket.id }),
    ).resolves.toMatchObject({
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
      title: 'Updated title',
    });
  });

  it('should return null from updateTicket when the ticket does not exist', async () => {
    const { projectId } = createTicketContext();

    await expect(
      ticketService.updateTicket(projectId, 999_999, { title: 'Ghost' }),
    ).resolves.toBeNull();
  });

  it('should soft-delete a ticket', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const ticket = await factory.ticket({
      projectId,
      reporterUserId,
      teamId,
      title: 'Ticket to delete',
    });

    await ticketService.deleteTicket(projectId, ticket.id);

    await expect(
      ticketRepository.findOneBy({ id: ticket.id }),
    ).resolves.toBeNull();
  });

  it('should throw from deleteTicket when the ticket does not exist', async () => {
    createTicketContext();

    const { projectId } = createTicketContext();
    await expect(
      ticketService.deleteTicket(projectId, 999_999),
    ).rejects.toBeDefined();
  });

  it('should support updateSession from the CRUD base for ticket escalation changes', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const nextAssigneeUserId = randomUUID();
    const ticket = await factory.ticket({
      projectId,
      reporterUserId,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.OPEN,
      teamId,
      title: 'Add the freshman orientation role',
    });

    const updateSession = ticketService.updateSession(ticket);

    ticket.assigneeUserId = nextAssigneeUserId;
    ticket.severity = TicketSeverity.CRITICAL;
    ticket.status = TicketStatus.IN_PROGRESS;

    await updateSession.save();

    await expect(
      ticketRepository.findOneByOrFail({ id: ticket.id }),
    ).resolves.toMatchObject({
      assigneeUserId: nextAssigneeUserId,
      id: ticket.id,
      severity: TicketSeverity.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
    });
  });

  it('should support updateEntry from the CRUD base for ticket closure updates', async () => {
    const { projectId, reporterUserId, teamId } = createTicketContext();
    const ticket = await factory.ticket({
      description: 'Initial triage note',
      projectId,
      reporterUserId,
      status: TicketStatus.RESOLVED,
      teamId,
      title: 'Close the duplicate access report',
    });

    await ticketService.updateEntry(ticket, {
      description: 'Closed after confirming the duplicate report.',
      status: TicketStatus.CLOSED,
      title: 'Duplicate access report closed',
    });

    expect(ticket).toMatchObject({
      description: 'Closed after confirming the duplicate report.',
      status: TicketStatus.CLOSED,
      title: 'Duplicate access report closed',
    });

    await expect(
      ticketRepository.findOneByOrFail({ id: ticket.id }),
    ).resolves.toMatchObject({
      description: 'Closed after confirming the duplicate report.',
      id: ticket.id,
      status: TicketStatus.CLOSED,
      title: 'Duplicate access report closed',
    });
  });
});
