import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { TicketSeverity, TicketStatus } from './enums';
import TicketEntity from './ticket.entity';

export type CreateTicketInput = Pick<
  TicketEntity,
  'projectId' | 'reporterUserId' | 'title'
> &
  Partial<
    Pick<
      TicketEntity,
      'teamId' | 'assigneeUserId' | 'description' | 'status' | 'severity'
    >
  >;

export type UpdateTicketInput = Partial<CreateTicketInput>;

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
    this.logger.log({
      log: 'Attempting to create ticket',
      input,
    });

    const ticket = this.ticketRepository.create(input);

    this.logger.log({
      log: 'Got ticket draft for creation',
      ticket,
    });

    const result = await this.ticketRepository.save(ticket);

    this.logger.log({
      log: 'Ticket create result',
      result,
    });

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

  async getListTicket(projectId: number): Promise<TicketEntity[]> {
    return this.listByProject(projectId);
  }

  async getDetailTicket(
    projectId: number,
    ticketId: number,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Attempting to get ticket detail',
      projectId,
      ticketId,
    });

    const result = await this.ticketRepository.findOne({
      where: {
        id: ticketId,
        projectId,
      },
    });

    this.logger.log({
      log: 'Got ticket detail result',
      projectId,
      ticketId,
      result,
    });

    return result;
  }

  async updateTicket(
    projectId: number,
    ticketId: number,
    input: UpdateTicketInput,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Attempting to update ticket',
      projectId,
      ticketId,
      input,
    });

    const ticket = await this.getDetailTicket(projectId, ticketId);

    if (!ticket) {
      this.logger.log({
        log: 'Ticket not found for update',
        projectId,
        ticketId,
      });

      return null;
    }

    Object.assign(ticket, input);

    const result = await this.ticketRepository.save(ticket);

    this.logger.log({
      log: 'Ticket update result',
      projectId,
      ticketId,
      result,
    });

    return result;
  }

  async deleteTicket(projectId: number, ticketId: number): Promise<boolean> {
    this.logger.log({
      log: 'Attempting to delete ticket',
      projectId,
      ticketId,
    });

    const ticket = await this.getDetailTicket(projectId, ticketId);

    if (!ticket) {
      this.logger.log({
        log: 'Ticket not found for delete',
        projectId,
        ticketId,
      });

      return false;
    }

    await this.ticketRepository.softRemove(ticket);

    this.logger.log({
      log: 'Ticket delete result',
      projectId,
      ticketId,
    });

    return true;
  }

  async getByStatus(
    projectId: number,
    status: TicketStatus,
  ): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to get tickets by status',
      projectId,
      status,
    });

    const result = await this.ticketRepository.find({
      where: { projectId, status },
    });

    this.logger.log({
      log: 'Got tickets by status result',
      projectId,
      status,
      count: result.length,
      ticketIds: result.map(({ id }) => id),
    });

    return result;
  }

  async getByAssignee(
    projectId: number,
    assigneeUserId: string,
  ): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to get tickets by assignee',
      projectId,
      assigneeUserId,
    });

    const result = await this.ticketRepository.find({
      where: {
        projectId,
        assigneeUserId,
      },
    });

    this.logger.log({
      log: 'Got tickets by assignee result',
      projectId,
      assigneeUserId,
      count: result.length,
      ticketIds: result.map(({ id }) => id),
    });

    return result;
  }

  async getBySeverity(
    projectId: number,
    severity: TicketSeverity,
  ): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to get tickets by severity',
      projectId,
      severity,
    });

    const result = await this.ticketRepository.find({
      where: {
        projectId,
        severity,
      },
    });

    this.logger.log({
      log: 'Got tickets by severity result',
      projectId,
      severity,
      count: result.length,
      ticketIds: result.map(({ id }) => id),
    });

    return result;
  }

  async markResolved(ticketId: number): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Attempting to mark ticket as resolved',
      ticketId,
    });

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    this.logger.log({
      log: 'Got ticket for resolution',
      ticketId,
      ticket,
    });

    if (!ticket) {
      this.logger.log({
        log: 'Ticket not found for resolution',
        ticketId,
      });

      return null;
    }

    ticket.status = TicketStatus.RESOLVED;

    const result = await this.ticketRepository.save(ticket);

    this.logger.log({
      log: 'Ticket resolution result',
      ticketId,
      result,
    });

    return result;
  }
}
