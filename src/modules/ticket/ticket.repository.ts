import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CRUDService } from '@src/common/utils/crud';

import TicketEntity from './ticket.entity';
import {
  TicketSeverity,
  TicketStatus,
} from './enums';

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

export type UpdateTicketInput = Partial<
  Pick<
    TicketEntity,
    | 'teamId'
    | 'assigneeUserId'
    | 'title'
    | 'description'
    | 'status'
    | 'severity'
  >
>;

@Injectable()
export class TicketRepository extends CRUDService<TicketEntity> {
  private readonly logger = new Logger(
    TicketRepository.name,
  );

  constructor(
    @InjectRepository(TicketEntity)
    private repository: Repository<TicketEntity>,
  ) {
    super(repository);
  }

  async createTicket(
    input: CreateTicketInput,
  ): Promise<TicketEntity> {
    this.logger.log({
      log: 'Attempting create ticket',
      input,
    });

    const ticket =
      this.repository.create(input);

    const result =
      await this.repository.save(ticket);

    this.logger.log({
      log: 'Create ticket result',
      result,
    });

    return result;
  }

  async getListTicket(
    projectId: number,
  ): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Get list ticket',
      projectId,
    });

    return await this.repository.find({
      where: { projectId },
      order: { id: 'DESC' },
    });
  }

  async getDetailTicket(
    id: number,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Get detail ticket',
      id,
    });

    return await this.repository.findOne({
      where: { id },
    });
  }

  async updateTicket(
    id: number,
    input: UpdateTicketInput,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Update ticket',
      id,
      input,
    });

    const ticket =
      await this.getDetailTicket(id);

    if (!ticket) {
      return null;
    }

    Object.assign(ticket, input);

    const result =
      await this.repository.save(ticket);

    this.logger.log({
      log: 'Update ticket result',
      result,
    });

    return result;
  }

  async deleteTicket(
    id: number,
  ): Promise<boolean> {
    this.logger.log({
      log: 'Delete ticket',
      id,
    });

    await this.repository.softDelete(id);

    return true;
  }

  async getByStatus(
    projectId: number,
    status: TicketStatus,
  ) {
    return await this.repository.find({
      where: { projectId, status },
    });
  }

  async getByAssignee(
    projectId: number,
    assigneeUserId: string,
  ) {
    return await this.repository.find({
      where: {
        projectId,
        assigneeUserId,
      },
    });
  }

  async getBySeverity(
    projectId: number,
    severity: TicketSeverity,
  ) {
    return await this.repository.find({
      where: {
        projectId,
        severity,
      },
    });
  }
}