import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { TicketSeverity, TicketStatus } from './enums';
import TicketEntity from './ticket.entity';
import TeamEntity from '../team/team.entity';
import TeamMemberEntity from '../team-member/team-member.entity';

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

  private async validateUserInProject(
    projectId: number,
    userId: string,
  ): Promise<void> {
    const memberCheck = await this.ticketRepository.manager
      .createQueryBuilder(TeamMemberEntity, 'member')
      .innerJoin(TeamEntity, 'team', 'team.id = member.team_id')
      .where('team.project_id = :projectId', { projectId })
      .andWhere('member.user_id = :userId', { userId })
      .getOne();

    if (!memberCheck) {
      throw new BadRequestException(
        `This user is not a member of any team in project ${projectId}`,
      );
    }
  }

  async createTicket(input: CreateTicketInput): Promise<TicketEntity> {
    this.logger.log({
      log: 'Attempting to create ticket',
      input,
    });
    if (input.assigneeUserId) {
      await this.validateUserInProject(input.projectId, input.assigneeUserId);
    }

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

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, projectId },
    });

    if (!ticket) {
      return null;
    }

    if (input.assigneeUserId) {
      await this.validateUserInProject(projectId, input.assigneeUserId);
    }

    Object.assign(ticket, input);
    return await this.ticketRepository.save(ticket);
  }

  async listByProject(projectId: number): Promise<TicketEntity[]> {
    this.logger.log({
      log: 'Attempting to list tickets by project',
      projectId,
    });

    const result = await this.ticketRepository.find({
      where: { projectId },
      relations: ['assigneeUser', 'reporterUser'],
      order: { id: 'DESC' },
    });

    this.logger.log({
      log: 'Got tickets by project result',
      projectId,
      count: result.length,
      ticketIds: result.map(({ id }) => id),
    });

    return result;
  }

  async getTicketById(
    projectId: number,
    ticketId: number,
  ): Promise<TicketEntity | null> {
    return await this.ticketRepository.findOne({
      where: { id: ticketId, projectId: projectId },
      relations: ['assigneeUser', 'reporterUser'],
    });
  }

  async updateStatus(
    projectId: number,
    ticketId: number,
    newStatus: TicketStatus,
  ): Promise<TicketEntity> {
    const ticket = await this.getTicketById(projectId, ticketId);

    this.logger.log({ log: 'Updating ticket status', ticketId, newStatus });

    if (!ticket) {
      throw new NotFoundException(
        `Ticket #${ticketId} in project ${projectId} not found`,
      );
    }

    ticket.status = newStatus;
    return await this.ticketRepository.save(ticket);
  }

  async assignTicket(
    projectId: number,
    ticketId: number,
    assigneeUserId: string,
  ): Promise<TicketEntity> {
    this.logger.log({ log: 'Assigning ticket', ticketId, assigneeUserId });

    const ticket = await this.getTicketById(projectId, ticketId);
    if (!ticket) {
      throw new NotFoundException(
        `Ticket #${ticketId} in project ${projectId} not found`,
      );
    }

    ticket.assigneeUserId = assigneeUserId;
    return await this.ticketRepository.save(ticket);
  }

  async deleteTicket(projectId: number, ticketId: number): Promise<void> {
    this.logger.log({ log: 'Deleting ticket', ticketId });

    const ticket = await this.getTicketById(projectId, ticketId);
    if (!ticket) {
      throw new NotFoundException(
        `Ticket #${ticketId} in project ${projectId} not found`,
      );
    }

    await this.ticketRepository.softDelete(ticketId);
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

  async markResolved(
    projectId: number,
    ticketId: number,
  ): Promise<TicketEntity | null> {
    this.logger.log({
      log: 'Attempting to mark ticket as resolved',
      projectId,
      ticketId,
    });

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, projectId: projectId },
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
