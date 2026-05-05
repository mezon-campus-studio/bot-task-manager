import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { TicketSeverity, TicketStatus } from './enums';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';

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

    const resolvedTicket = await ticketService.markResolved(ticket.id);

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
    await expect(ticketService.markResolved(999_999)).resolves.toBeNull();
    await expect(ticketRepository.count()).resolves.toBe(0);
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

  it('should assign and reassign a ticket only when assignee is active in the current project scope', async () => {
    const reporter = await factory.user();
    const project = await factory.project();
    const assignee = await factory.user();
    const nextAssignee = await factory.user();

    await factory.projectMember({
      projectId: project.id,
      userId: assignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    await factory.projectMember({
      projectId: project.id,
      userId: nextAssignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    const ticket = await factory.ticket({
      assigneeUserId: null,
      projectId: project.id,
      reporterUserId: reporter.id,
      teamId: nextNumericId(),
      title: 'Project scope assignment test',
    });

    const assignedTicket = await ticketService.assignTicket(
      project.id,
      ticket.id,
      assignee.id,
    );

    expect(assignedTicket).toMatchObject({
      id: ticket.id,
      assigneeUserId: assignee.id,
    });

    const reassignedTicket = await ticketService.assignTicket(
      project.id,
      ticket.id,
      nextAssignee.id,
    );

    expect(reassignedTicket).toMatchObject({
      id: ticket.id,
      assigneeUserId: nextAssignee.id,
    });
  });

  it('should unassign a ticket when assigneeId is null', async () => {
    const reporter = await factory.user();
    const project = await factory.project();
    const assignee = await factory.user();

    await factory.projectMember({
      projectId: project.id,
      userId: assignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    const ticket = await factory.ticket({
      assigneeUserId: assignee.id,
      projectId: project.id,
      reporterUserId: reporter.id,
      teamId: nextNumericId(),
      title: 'Ticket will be unassigned',
    });

    const unassignedTicket = await ticketService.assignTicket(
      project.id,
      ticket.id,
      null,
    );

    expect(unassignedTicket).toMatchObject({
      id: ticket.id,
      assigneeUserId: null,
    });
  });

  it('should update assigneeUserId via generic updateTicket with project scope validation', async () => {
    const reporter = await factory.user();
    const project = await factory.project();
    const firstAssignee = await factory.user();
    const secondAssignee = await factory.user();

    await factory.projectMember({
      projectId: project.id,
      userId: firstAssignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    await factory.projectMember({
      projectId: project.id,
      userId: secondAssignee.id,
      status: ProjectMemberStatus.ACTIVE,
    });

    const ticket = await factory.ticket({
      assigneeUserId: firstAssignee.id,
      projectId: project.id,
      reporterUserId: reporter.id,
      severity: TicketSeverity.MEDIUM,
      status: TicketStatus.OPEN,
      teamId: nextNumericId(),
      title: 'Update assignee via generic update',
    });

    const updatedTicket = await ticketService.updateTicket(
      project.id,
      ticket.id,
      {
        assigneeUserId: secondAssignee.id,
        status: TicketStatus.IN_PROGRESS,
      },
    );

    expect(updatedTicket).toMatchObject({
      id: ticket.id,
      assigneeUserId: secondAssignee.id,
      status: TicketStatus.IN_PROGRESS,
    });

    const unassignedTicket = await ticketService.updateTicket(
      project.id,
      ticket.id,
      {
        assigneeUserId: null,
      },
    );

    expect(unassignedTicket).toMatchObject({
      id: ticket.id,
      assigneeUserId: null,
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
