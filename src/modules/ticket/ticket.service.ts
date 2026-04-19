import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { TicketStatus } from './enums';
import TicketEntity from './ticket.entity';

export type CreateTicketInput = Pick<
  TicketEntity,
  | 'projectId'
  | 'teamId'
  | 'assigneeUserId'
  | 'reporterUserId'
  | 'title'
  | 'description'
  | 'status'
  | 'severity'
>;

@Injectable()
export class TicketService extends CRUDService<TicketEntity> {
  private readonly logger = new Logger(TicketService.name);

  constructor(
    @InjectRepository(TicketEntity)
    private ticketRepository: Repository<TicketEntity>,
  ) {
    super(ticketRepository);
  }

  async createTicket(input: CreateTicketInput): Promise<TicketEntity> {
    this.logger.log({ log: 'Attempting to create ticket', input });
    const ticket = this.ticketRepository.create(input);
    this.logger.log({ log: 'Got ticket draft for creation', ticket });

    const result = await this.ticketRepository.save(ticket);
    this.logger.log({ log: 'Ticket create result', result });

    return result;
  }

  async listByProject(projectId: number): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to list tickets by project',
      projectId,
    });

    const result = await this.ticketRepository.find({
      where: { projectId },
      order: {
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got tickets by project result',
      projectId,
      count: result.length,
      ticketIds: result.map(({ id }) => id),
    });

    return result;
  }

  async markResolved(ticketId: number): Promise<TicketEntity | null> {
    this.logger.log({ log: 'Attempting to mark ticket as resolved', ticketId });

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    this.logger.log({ log: 'Got ticket for resolution', ticketId, ticket });

    if (!ticket) {
      this.logger.log({ log: 'Ticket not found for resolution', ticketId });
      return null;
    }

    ticket.status = TicketStatus.RESOLVED;

    const result = await this.ticketRepository.save(ticket);
    this.logger.log({ log: 'Ticket resolution result', ticketId, result });

    return result;
  }
}
