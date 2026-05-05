import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import TicketEntity from './ticket.entity';
import UserEntity from '@src/modules/user/user.entity';
import ProjectEntity from '@src/modules/project/project.entity';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';

export interface TicketAssignmentValidationResult {
  ticket: TicketEntity;
  assigneeUser: UserEntity;
  project: ProjectEntity;
  projectMember: ProjectMemberEntity;
  isReassignment: boolean;
  previousAssigneeUserId: string | null;
}

@Injectable()
export class TicketAssignmentValidatorService {
  private readonly logger = new Logger(
    TicketAssignmentValidatorService.name,
  );

  constructor(
    @InjectRepository(TicketEntity)
    private ticketRepository: Repository<TicketEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(ProjectEntity)
    private projectRepository: Repository<ProjectEntity>,
    @InjectRepository(ProjectMemberEntity)
    private projectMemberRepository: Repository<ProjectMemberEntity>,
  ) {}

  /**
   * Validate ticket-user assignment and check project scope
   * Performs comprehensive validation pipeline:
   * 1. Validate ticket exists in the project
   * 2. Validate assignee user exists
   * 3. Check if user is an active member of the project
   * 4. Check project exists
   * 5. Determine if this is reassignment
   */
  async validateAssignment(
    projectId: number,
    ticketId: number,
    assigneeUserId: string,
  ): Promise<TicketAssignmentValidationResult> {
    this.logger.log({
      log: 'Starting ticket assignment validation pipeline',
      projectId,
      ticketId,
      assigneeUserId,
    });

    // Step 1: Validate ticket exists and belongs to project
    const ticket = await this.validateTicketExists(
      projectId,
      ticketId,
    );

    // Step 2: Validate assignee user exists
    const assigneeUser =
      await this.validateUserExists(assigneeUserId);

    // Step 3: Validate project exists
    const project = await this.validateProjectExists(
      projectId,
    );

    // Step 4: Check if user is an active member of the project (project scope)
    const projectMember =
      await this.validateProjectMembership(
        projectId,
        assigneeUserId,
      );

    // Step 5: Determine if this is a reassignment
    const isReassignment =
      ticket.assigneeUserId !== null &&
      ticket.assigneeUserId !== assigneeUserId;
    const previousAssigneeUserId = ticket.assigneeUserId;

    this.logger.log({
      log: 'Ticket assignment validation pipeline completed successfully',
      projectId,
      ticketId,
      assigneeUserId,
      isReassignment,
      previousAssigneeUserId,
    });

    return {
      ticket,
      assigneeUser,
      project,
      projectMember,
      isReassignment,
      previousAssigneeUserId,
    };
  }

  /**
   * Validate ticket exists and belongs to the specified project
   */
  private async validateTicketExists(
    projectId: number,
    ticketId: number,
  ): Promise<TicketEntity> {
    this.logger.log({
      log: 'Validating ticket existence',
      projectId,
      ticketId,
    });

    const ticket = await this.ticketRepository.findOne({
      where: {
        id: ticketId,
        projectId,
      },
    });

    if (!ticket) {
      this.logger.error({
        log: 'Ticket not found in project',
        projectId,
        ticketId,
      });

      throw new NotFoundException(
        `Ticket #${ticketId} not found in project ${projectId}`,
      );
    }

    this.logger.log({
      log: 'Ticket validation passed',
      ticketId,
      title: ticket.title,
    });

    return ticket;
  }

  /**
   * Validate user exists in the system
   */
  private async validateUserExists(
    userId: string,
  ): Promise<UserEntity> {
    this.logger.log({
      log: 'Validating user existence',
      userId,
    });

    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.error({
        log: 'User not found',
        userId,
      });

      throw new NotFoundException(
        `User ${userId} not found`,
      );
    }

    this.logger.log({
      log: 'User validation passed',
      userId,
      userName: user.name,
    });

    return user;
  }

  /**
   * Validate project exists
   */
  private async validateProjectExists(
    projectId: number,
  ): Promise<ProjectEntity> {
    this.logger.log({
      log: 'Validating project existence',
      projectId,
    });

    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      this.logger.error({
        log: 'Project not found',
        projectId,
      });

      throw new NotFoundException(
        `Project ${projectId} not found`,
      );
    }

    this.logger.log({
      log: 'Project validation passed',
      projectId,
      projectName: project.name,
    });

    return project;
  }

  /**
   * Check if user is an active member of the project (project scope validation)
   * User must have ACTIVE status to be eligible for ticket assignment
   */
  private async validateProjectMembership(
    projectId: number,
    userId: string,
  ): Promise<ProjectMemberEntity> {
    this.logger.log({
      log: 'Validating project membership - checking project scope',
      projectId,
      userId,
    });

    const projectMember =
      await this.projectMemberRepository.findOne({
        where: {
          projectId,
          userId,
        },
      });

    if (!projectMember) {
      this.logger.error({
        log: 'User is not a member of project',
        projectId,
        userId,
      });

      throw new ForbiddenException(
        `User ${userId} is not a member of project ${projectId}`,
      );
    }

    // Check if user has ACTIVE status
    if (projectMember.status !== ProjectMemberStatus.ACTIVE) {
      this.logger.error({
        log: 'User is not active in project',
        projectId,
        userId,
        membershipStatus: projectMember.status,
      });

      throw new ForbiddenException(
        `User ${userId} is not active in project ${projectId}. Status: ${projectMember.status}`,
      );
    }

    this.logger.log({
      log: 'Project membership validation passed - user is active in project scope',
      projectId,
      userId,
      membershipStatus: projectMember.status,
    });

    return projectMember;
  }
}
