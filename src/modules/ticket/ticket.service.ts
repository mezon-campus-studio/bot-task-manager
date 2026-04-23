import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { TicketStatus, TicketSeverity } from './enums';
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
  private readonly logger = new Logger(
    TicketService.name,
  );

  constructor(
    @InjectRepository(TicketEntity)
    private ticketRepository: Repository<TicketEntity>,
  ) {
    super(ticketRepository);
  }

  async createTicket(
    input: CreateTicketInput,
  ): Promise<TicketEntity> {
    this.logger.log({
      log: 'Attempting to create ticket',
      input,
    });

    const ticket =
      this.ticketRepository.create(input);

    this.logger.log({
      log: 'Got ticket draft for creation',
      ticket,
    });

    const result =
      await this.ticketRepository.save(
        ticket,
      );

    this.logger.log({
      log: 'Ticket create result',
      result,
    });

    return result;
  }

  async listByProject(
    projectId: number,
  ): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to list tickets by project',
      projectId,
    });

    const result =
      await this.ticketRepository.find({
        where: { projectId },
        order: {
          id: 'DESC',
        },
      });

    this.logger.log({
      log: 'Got tickets by project result',
      projectId,
      count: result.length,
      ticketIds: result.map(
        ({ id }) => id,
      ),
    });

    return result;
  }

  async getListTicket(
    projectId: number,
  ): Promise<TicketEntity[]> {
    return await this.listByProject(
      projectId,
    );
  }

  async getDetailTicket(
    projectId: number,
    ticketId: number,
  ): Promise<TicketEntity | null> {
    return await this.ticketRepository.findOne({
      where: {
        id: ticketId,
        projectId,
      },
    });
  }

  async updateTicket(
    projectId: number,
    ticketId: number,
    input: Partial<CreateTicketInput>,
  ): Promise<TicketEntity | null> {
    const ticket =
      await this.getDetailTicket(
        projectId,
        ticketId,
      );

    if (!ticket) {
      return null;
    }

    Object.assign(ticket, input);

    return await this.ticketRepository.save(
      ticket,
    );
  }

  async deleteTicket(
    projectId: number,
    ticketId: number,
  ): Promise<boolean> {
    const ticket =
      await this.getDetailTicket(
        projectId,
        ticketId,
      );

    if (!ticket) {
      return false;
    }

    await this.ticketRepository.softDelete(
      ticketId,
    );

    return true;
  }

  

  async markResolved(
    ticketId: number,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Attempting to mark ticket as resolved',
      ticketId,
    });

    const ticket =
      await this.ticketRepository.findOne({
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

    ticket.status =
      TicketStatus.RESOLVED;

    const result =
      await this.ticketRepository.save(
        ticket,
      );

    this.logger.log({
      log: 'Ticket resolution result',
      ticketId,
      result,
    });

    return result;
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
      order: { id: 'DESC' },
    });

    this.logger.log({
      log: 'Got tickets by status result',
      projectId,
      status,
      count: result.length,
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
      where: { projectId, assigneeUserId },
      order: { id: 'DESC' },
    });

    this.logger.log({
      log: 'Got tickets by assignee result',
      projectId,
      assigneeUserId,
      count: result.length,
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
      where: { projectId, severity },
      order: { id: 'DESC' },
    });

    this.logger.log({
      log: 'Got tickets by severity result',
      projectId,
      severity,
      count: result.length,
    });

    return result;
  }
}

  