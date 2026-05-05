import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { TeamMemberStatus } from './enums/team-member-status.enum';
import TeamMemberEntity from './team-member.entity';
import { TeamService } from '../team/team.service';
import { UserService } from '../user/user.service';
import { ProjectService } from '../project/project.service';

type CreateTeamMemberInput = Pick<TeamMemberEntity, 'teamId' | 'userId'> &
  Partial<Pick<TeamMemberEntity, 'status' | 'invitedByUserId' | 'joinedAt'>>;

@Injectable()
export class TeamMemberService extends CRUDService<TeamMemberEntity> {
  private readonly logger = new Logger(TeamMemberService.name);

  constructor(
    @InjectRepository(TeamMemberEntity)
    private readonly teamMemberRepository: Repository<TeamMemberEntity>,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly projectService: ProjectService,
  ) {
    super(teamMemberRepository);
  }

  async createMembership(
    input: CreateTeamMemberInput,
  ): Promise<TeamMemberEntity> {
    this.logger.log({
      log: 'Attempting to create team membership',
      status: input.status ?? TeamMemberStatus.INVITED,
      teamId: input.teamId,
      userId: input.userId,
    });

    const membership = this.teamMemberRepository.create({
      ...input,
      status: input.status ?? TeamMemberStatus.INVITED,
      invitedByUserId: input.invitedByUserId ?? null,
      joinedAt: input.joinedAt ?? null,
    });

    return this.teamMemberRepository.save(membership);
  }

  async findMembership(
    teamId: number,
    userId: string,
  ): Promise<TeamMemberEntity | null> {
    this.logger.log({
      log: 'Attempting to find team membership',
      teamId,
      userId,
    });

    return this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });
  }

  async findByTeamId(teamId: number): Promise<TeamMemberEntity[]> {
    this.logger.log({
      log: 'Attempting to list team memberships',
      teamId,
    });

    return this.teamMemberRepository.find({
      where: { teamId },
      order: { id: 'ASC' },
    });
  }

  async findActiveMembersByTeamId(teamId: number): Promise<TeamMemberEntity[]> {
    this.logger.log({
      log: 'Attempting to list active team memberships',
      teamId,
    });

    return this.teamMemberRepository.find({
      where: { teamId, status: TeamMemberStatus.ACTIVE },
      order: { id: 'ASC' },
    });
  }

  private async validateContext(
    projectId: number,
    teamId: number,
    userId: string,
  ) {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const project = await this.projectService.findById(projectId);
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const team = await this.teamService.findById(teamId);
    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    if (team.projectId !== projectId) {
      throw new ConflictException(
        `Team ${teamId} does not belong to Project ${projectId}`,
      );
    }

    return { team, user, project };
  }

  async addMember(
    projectId: number,
    teamId: number,
    userId: string,
    invitedBy: string,
  ): Promise<TeamMemberEntity> {
    await this.validateContext(projectId, teamId, userId);

    const existingMember = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
      withDeleted: true,
    });

    if (existingMember) {
      if (!existingMember.deletedAt && existingMember.status === TeamMemberStatus.ACTIVE) {
        throw new ConflictException('User is already an active member of this team');
      }

      await this.teamMemberRepository.restore(existingMember.id);
      existingMember.status = TeamMemberStatus.ACTIVE;
      existingMember.joinedAt = new Date();
      existingMember.invitedByUserId = invitedBy;
      existingMember.deletedAt = null; // Important: clear deletedAt before saving

      return await this.teamMemberRepository.save(existingMember);
    }

    return await this.createMembership({
      teamId,
      userId,
      status: TeamMemberStatus.ACTIVE,
      invitedByUserId: invitedBy,
      joinedAt: new Date(),
    });
  }

  async removeMember(
    projectId: number,
    teamId: number,
    userId: string,
  ): Promise<{ message: string }> {
    await this.validateContext(projectId, teamId, userId);

    const member = await this.teamMemberRepository.findOne({
      where: { teamId, userId },
    });

    if (!member) {
      throw new NotFoundException('User is not a member of this team');
    }

    await this.teamMemberRepository.softDelete(member.id);

    this.logger.log({
      log: 'Team member removed successfully',
      teamId,
      userId,
    });

    return {
      message: `User ${userId} has been removed from team ${teamId}`,
    };
  }
}
