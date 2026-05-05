import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { CreateTeamMemberDto } from './dtos/create-team-member.dto';
import { TeamMemberStatus } from './enums/team-member-status.enum';
import TeamMemberEntity from './team-member.entity';
import { ProjectMemberService } from '../project-member/project-member.service';
import { TeamService } from '../team';

@Injectable()
export class TeamMemberService extends CRUDService<TeamMemberEntity> {
  private readonly logger = new Logger(TeamMemberService.name);

  constructor(
    @InjectRepository(TeamMemberEntity)
    private readonly teamMemberRepository: Repository<TeamMemberEntity>,
    @Inject(forwardRef(() => TeamService))
    private readonly teamService: TeamService,
    @Inject(forwardRef(() => ProjectMemberService))
    private readonly projectMemberService: ProjectMemberService,
  ) {
    super(teamMemberRepository);
  }

  async createMembership(
    input: CreateTeamMemberDto,
  ): Promise<TeamMemberEntity> {
    const existing = await this.findMembership(input.teamId, input.userId);
    if (existing) {
      throw new ConflictException('User is already a member of this team');
    }

    const team = await this.teamService.findOne({
      where: { id: input.teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${input.teamId} not found`);
    }

    await this.projectMemberService.upsertMembership({
      projectId: team.projectId,
      userId: input.userId,
      invitedByUserId: input.invitedByUserId,
    });

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
}
