import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import ProjectEntity from '@src/modules/project/project.entity';
import UserEntity from '@src/modules/user/user.entity';
import { ProjectMemberStatus } from './project-member-status.enum';
import ProjectMemberEntity from './project-member.entity';

type UpsertProjectMemberInput = Pick<
  ProjectMemberEntity,
  'projectId' | 'userId'
> &
  Partial<Pick<ProjectMemberEntity, 'invitedByUserId' | 'joinedAt' | 'status'>>;

type InviteProjectMemberInput = Pick<
  ProjectMemberEntity,
  'projectId' | 'userId'
> &
  Partial<Pick<ProjectMemberEntity, 'invitedByUserId'>>;

@Injectable()
export class ProjectMemberService extends CRUDService<ProjectMemberEntity> {
  private readonly logger = new Logger(ProjectMemberService.name);

  constructor(
    @InjectRepository(ProjectMemberEntity)
    private projectMemberRepository: Repository<ProjectMemberEntity>,
  ) {
    super(projectMemberRepository);
  }

  async findById(id: number): Promise<ProjectMemberEntity | null> {
    this.logger.log({
      log: 'Attempting to find project membership by id',
      id,
    });

    const result = await this.projectMemberRepository.findOne({
      where: { id },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback project membership lookup result because membership was not found by id',
        id,
      });

      return null;
    }

    this.logger.log({
      log: 'Got project membership by id',
      id,
      result: {
        id: result.id,
        projectId: result.projectId,
        userId: result.userId,
      },
    });

    return result;
  }

  async findByProjectAndUser(
    projectId: number,
    userId: string,
  ): Promise<ProjectMemberEntity | null> {
    this.logger.log({
      log: 'Attempting to find project membership by project and user',
      projectId,
      userId,
    });

    const result = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback project membership lookup result because membership was not found by project and user',
        projectId,
        userId,
      });

      return null;
    }

    this.logger.log({
      log: 'Got project membership by project and user',
      projectId,
      userId,
      result: {
        id: result.id,
        status: result.status,
      },
    });

    return result;
  }

  async upsertMembership(
    input: UpsertProjectMemberInput,
  ): Promise<ProjectMemberEntity> {
    this.logger.log({
      log: 'Attempting to upsert project membership',
      projectId: input.projectId,
      userId: input.userId,
      status: input.status,
      invitedByUserId: input.invitedByUserId,
    });

    const membership = this.projectMemberRepository.create({
      ...input,
      invitedByUserId: input.invitedByUserId ?? null,
      joinedAt: input.joinedAt ?? null,
      invitedByUser:
        input.invitedByUserId == null
          ? null
          : ({ id: input.invitedByUserId } as never),
      project: { id: input.projectId } as never,
      status: input.status ?? ProjectMemberStatus.INVITED,
      user: { id: input.userId } as never,
    });

    await this.projectMemberRepository.upsert(membership, [
      'projectId',
      'userId',
    ]);

    this.logger.log({
      log: 'Project membership upsert result',
      result: {
        projectId: membership.projectId,
        userId: membership.userId,
        status: membership.status,
      },
    });

    const result = await this.findByProjectAndUser(
      input.projectId,
      input.userId,
    );

    if (result == null) {
      this.logger.log({
        log: 'Fallback to created project membership payload because repository lookup returned null after upsert',
        projectId: input.projectId,
        userId: input.userId,
        status: membership.status,
      });

      return membership;
    }

    this.logger.log({
      log: 'Got persisted project membership after upsert',
      result: {
        id: result.id,
        projectId: result.projectId,
        userId: result.userId,
        status: result.status,
      },
    });

    return result;
  }

  async inviteProjectMember(
    input: InviteProjectMemberInput,
  ): Promise<ProjectMemberEntity> {
    this.logger.log({
      log: 'Attempting to invite project member',
      projectId: input.projectId,
      userId: input.userId,
      invitedByUserId: input.invitedByUserId,
    });

    await this.validateInviteInput(input, this.projectMemberRepository.manager);

    const existingMembership = await this.findByProjectAndUser(
      input.projectId,
      input.userId,
    );

    if (existingMembership != null) {
      this.logger.log({
        log: 'Project member invite failed because membership already exists',
        membershipId: existingMembership.id,
        projectId: input.projectId,
        userId: input.userId,
      });

      throw new ConflictException('Project member already exists');
    }

    const membership = this.projectMemberRepository.create({
      invitedByUser:
        input.invitedByUserId == null
          ? null
          : ({ id: input.invitedByUserId } as never),
      invitedByUserId: input.invitedByUserId ?? null,
      joinedAt: null,
      project: { id: input.projectId } as never,
      projectId: input.projectId,
      status: ProjectMemberStatus.INVITED,
      user: { id: input.userId } as never,
      userId: input.userId,
    });

    const result = await this.projectMemberRepository.save(membership);

    this.logger.log({
      log: 'Project member invite result',
      result: {
        id: result.id,
        projectId: result.projectId,
        status: result.status,
        userId: result.userId,
      },
    });

    return result;
  }

  private async validateInviteInput(
    input: InviteProjectMemberInput,
    transactionalEntityManager: EntityManager,
  ): Promise<void> {
    const project = await transactionalEntityManager.findOne(ProjectEntity, {
      where: { id: input.projectId },
    });

    if (project == null) {
      throw new NotFoundException('Project not found');
    }

    const user = await transactionalEntityManager.findOne(UserEntity, {
      where: { id: input.userId },
    });

    if (user == null) {
      throw new NotFoundException('User not found');
    }

    if (input.invitedByUserId == null) {
      return;
    }

    const inviter = await transactionalEntityManager.findOne(UserEntity, {
      where: { id: input.invitedByUserId },
    });

    if (inviter == null) {
      throw new NotFoundException('Inviter not found');
    }
  }
}
