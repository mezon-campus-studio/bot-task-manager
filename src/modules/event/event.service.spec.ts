import { randomUUID } from 'node:crypto';
import { DataSource, type Repository } from 'typeorm';
import { createTestingModule, factory, testingModule } from '#jest';
import { EventStatus } from './enums';
import EventEntity from './event.entity';
import { EventService } from './event.service';

describe(EventService.name, () => {
  let eventService: EventService;
  let eventRepository: Repository<EventEntity>;
  let numericSequence = 0;

  beforeAll(createTestingModule);

  beforeAll(() => {
    eventService = testingModule!.get(EventService);
    eventRepository = testingModule!.get(DataSource).getRepository(EventEntity);
  });

  function nextNumericId() {
    numericSequence += 1;
    return numericSequence;
  }

  function createEventContext() {
    return {
      ownerUserId: randomUUID(),
      projectId: nextNumericId(),
      teamId: nextNumericId(),
    };
  }

  it('should create a scheduled event for the project calendar', async () => {
    const { ownerUserId, projectId, teamId } = createEventContext();
    const startsAt = new Date('2026-07-01T09:00:00.000Z');
    const endsAt = new Date('2026-07-01T11:00:00.000Z');

    const event = await eventService.createEvent({
      description: 'Walk the campus coordinators through the launch workflow.',
      endsAt,
      location: 'Room A-204',
      ownerUserId,
      projectId,
      startsAt,
      status: EventStatus.SCHEDULED,
      teamId,
      title: 'Campus workflow onboarding session',
    });

    expect(event).toMatchObject({
      description: 'Walk the campus coordinators through the launch workflow.',
      id: expect.any(Number),
      location: 'Room A-204',
      ownerUserId,
      projectId,
      status: EventStatus.SCHEDULED,
      teamId,
      title: 'Campus workflow onboarding session',
    });
    expect(event.startsAt.toISOString()).toBe(startsAt.toISOString());
    expect(event.endsAt?.toISOString()).toBe(endsAt.toISOString());

    const storedEvent = await eventRepository.findOneByOrFail({ id: event.id });

    expect(storedEvent).toMatchObject({
      id: event.id,
      location: 'Room A-204',
      ownerUserId,
      projectId,
      status: EventStatus.SCHEDULED,
      teamId,
      title: 'Campus workflow onboarding session',
    });
    expect(storedEvent.startsAt.toISOString()).toBe(startsAt.toISOString());
    expect(storedEvent.endsAt?.toISOString()).toBe(endsAt.toISOString());
  });

  it('should return project events ordered by start time and newest id for ties', async () => {
    const { ownerUserId, projectId, teamId } = createEventContext();
    const otherProjectId = nextNumericId();
    const sharedStartsAt = new Date('2026-08-10T14:00:00.000Z');

    const firstEvent = await factory.event({
      ownerUserId,
      projectId,
      startsAt: new Date('2026-08-09T14:00:00.000Z'),
      teamId,
      title: 'Prepare welcome packet review',
    });
    const olderSameTimeEvent = await factory.event({
      ownerUserId,
      projectId,
      startsAt: sharedStartsAt,
      teamId,
      title: 'Advisor office hours',
    });
    const newerSameTimeEvent = await factory.event({
      ownerUserId,
      projectId,
      startsAt: sharedStartsAt,
      teamId,
      title: 'Mentor office hours',
    });

    await factory.event({
      ownerUserId: randomUUID(),
      projectId: otherProjectId,
      startsAt: new Date('2026-08-01T09:00:00.000Z'),
      teamId: nextNumericId(),
      title: 'Ignore other project event',
    });

    const events = await eventService.listByProject(projectId);

    expect(events).toHaveLength(3);
    expect(events.map(({ id }) => id)).toEqual([
      firstEvent.id,
      newerSameTimeEvent.id,
      olderSameTimeEvent.id,
    ]);
    expect(events.every((event) => event.projectId === projectId)).toBe(true);
  });

  it('should cancel an existing project event when the plan changes', async () => {
    const { ownerUserId, projectId, teamId } = createEventContext();
    const event = await factory.event({
      ownerUserId,
      projectId,
      status: EventStatus.SCHEDULED,
      teamId,
      title: 'Campus town hall',
    });

    const cancelledEvent = await eventService.cancelEvent(event.id);

    expect(cancelledEvent).toMatchObject({
      id: event.id,
      status: EventStatus.CANCELLED,
    });

    await expect(
      eventRepository.findOneByOrFail({ id: event.id }),
    ).resolves.toMatchObject({
      id: event.id,
      status: EventStatus.CANCELLED,
      title: 'Campus town hall',
    });
  });

  it('should return null when the event to cancel does not exist', async () => {
    await expect(eventService.cancelEvent(999_999)).resolves.toBeNull();
    await expect(eventRepository.count()).resolves.toBe(0);
  });

  it('should support updateSession from the CRUD base for event planning changes', async () => {
    const rescheduledEndsAt = new Date('2026-09-01T13:00:00.000Z');
    const { ownerUserId, projectId, teamId } = createEventContext();
    const event = await factory.event({
      location: 'Room B-101',
      ownerUserId,
      projectId,
      status: EventStatus.DRAFT,
      teamId,
      title: 'Prepare the advisor training session',
    });

    const updateSession = eventService.updateSession(event);

    event.endsAt = rescheduledEndsAt;
    event.location = 'Main Auditorium';
    event.status = EventStatus.SCHEDULED;

    await updateSession.save();

    const storedEvent = await eventRepository.findOneByOrFail({ id: event.id });

    expect(storedEvent).toMatchObject({
      id: event.id,
      location: 'Main Auditorium',
      status: EventStatus.SCHEDULED,
    });
    expect(storedEvent.endsAt?.toISOString()).toBe(
      rescheduledEndsAt.toISOString(),
    );
  });

  it('should support updateEntry from the CRUD base for event completion changes', async () => {
    const completedAt = new Date('2026-09-15T11:00:00.000Z');
    const { ownerUserId, projectId, teamId } = createEventContext();
    const event = await factory.event({
      endsAt: null,
      ownerUserId,
      projectId,
      status: EventStatus.SCHEDULED,
      teamId,
      title: 'Host the mentor kickoff',
    });

    await eventService.updateEntry(event, {
      endsAt: completedAt,
      status: EventStatus.COMPLETED,
      title: 'Mentor kickoff completed',
    });

    expect(event).toMatchObject({
      status: EventStatus.COMPLETED,
      title: 'Mentor kickoff completed',
    });
    expect(event.endsAt?.toISOString()).toBe(completedAt.toISOString());

    const storedEvent = await eventRepository.findOneByOrFail({ id: event.id });

    expect(storedEvent).toMatchObject({
      id: event.id,
      status: EventStatus.COMPLETED,
      title: 'Mentor kickoff completed',
    });
    expect(storedEvent.endsAt?.toISOString()).toBe(completedAt.toISOString());
  });
});
