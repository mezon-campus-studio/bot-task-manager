import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { EventStatus } from './enums';
import EventEntity from './event.entity';

export type CreateEventInput = Pick<
  EventEntity,
  | 'projectId'
  | 'teamId'
  | 'ownerUserId'
  | 'title'
  | 'description'
  | 'status'
  | 'startsAt'
  | 'endsAt'
  | 'location'
>;

@Injectable()
export class EventService extends CRUDService<EventEntity> {
  private readonly logger = new Logger(EventService.name);

  constructor(
    @InjectRepository(EventEntity)
    private eventRepository: Repository<EventEntity>,
  ) {
    super(eventRepository);
  }

  async createEvent(input: CreateEventInput): Promise<EventEntity> {
    this.logger.log({ log: 'Attempting to create event', input });
    const event = this.eventRepository.create(input);
    this.logger.log({ log: 'Got event draft for creation', event });

    const result = await this.eventRepository.save(event);
    this.logger.log({ log: 'Event create result', result });

    return result;
  }

  async listByProject(projectId: number): Promise<EventEntity[]> {
    this.logger.log({ log: 'Attempting to list events by project', projectId });

    const result = await this.eventRepository.find({
      where: { projectId },
      order: {
        startsAt: 'ASC',
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got events by project result',
      projectId,
      count: result.length,
      eventIds: result.map(({ id }) => id),
    });

    return result;
  }

  async findById(id: number): Promise<EventEntity | null> {
    this.logger.log({ log: 'Attempting to find event by id', eventId: id });

    const result = await this.eventRepository.findOne({
      where: { id },
    });

    this.logger.log({ log: 'Got event by id result', eventId: id, result });

    return result;
  }

  async cancelEvent(eventId: number): Promise<EventEntity | null> {
    this.logger.log({ log: 'Attempting to cancel event', eventId });

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
    });

    this.logger.log({ log: 'Got event for cancellation', eventId, event });

    if (!event) {
      this.logger.log({ log: 'Event not found for cancellation', eventId });
      return null;
    }

    event.status = EventStatus.CANCELLED;

    const result = await this.eventRepository.save(event);
    this.logger.log({ log: 'Event cancellation result', eventId, result });

    return result;
  }
}
