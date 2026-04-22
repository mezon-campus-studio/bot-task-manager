import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { RoleScopeType } from '@src/modules/role/enums/role-scope-type.enum';
import UserRoleAssignmentEntity from './user-role-assignment.entity';

type CreateUserRoleAssignmentInput = Pick<
  UserRoleAssignmentEntity,
  'userId' | 'roleId' | 'scopeType'
> &
  Partial<
    Pick<UserRoleAssignmentEntity, 'projectId' | 'teamId' | 'assignedByUserId'>
  >;

type FindAssignmentsInput = {
  userId?: string;
  roleId?: number;
  scopeType?: RoleScopeType;
  projectId?: number | null;
  teamId?: number | null;
};

@Injectable()
export class UserRoleAssignmentService extends CRUDService<UserRoleAssignmentEntity> {
  private readonly logger = new Logger(UserRoleAssignmentService.name);

  constructor(
    @InjectRepository(UserRoleAssignmentEntity)
    private readonly userRoleAssignmentRepository: Repository<UserRoleAssignmentEntity>,
  ) {
    super(userRoleAssignmentRepository);
  }

  async createAssignment(
    input: CreateUserRoleAssignmentInput,
  ): Promise<UserRoleAssignmentEntity> {
    this.logger.log({
      log: 'Attempting to create user role assignment',
      roleId: input.roleId,
      scopeType: input.scopeType,
      teamId: input.teamId ?? null,
      userId: input.userId,
    });
    const exist = await this.userRoleAssignmentRepository.findOne({
      where: {
        userId: input.userId,
        roleId: input.roleId,
        scopeType: input.scopeType,
        projectId: input.projectId ?? IsNull(),
        teamId: input.teamId ?? IsNull(),
      },
    });

    if (exist) {
      this.logger.log({
        log: 'User role assignment already exists, skipping creation',
      });
      throw new Error('User role assignment already exists');
    }

    const assignment = this.userRoleAssignmentRepository.create({
      ...input,
      projectId: input.projectId ?? null,
      teamId: input.teamId ?? null,
      assignedByUserId: input.assignedByUserId ?? null,
    });

    return this.userRoleAssignmentRepository.save(assignment);
  }

  async findAssignments(
    filters: FindAssignmentsInput,
  ): Promise<UserRoleAssignmentEntity[]> {
    this.logger.log({
      filters,
      log: 'Attempting to list user role assignments',
    });

    const where: FindOptionsWhere<UserRoleAssignmentEntity> = {};

    if (filters.userId !== undefined) {
      where.userId = filters.userId;
    }
    if (filters.roleId !== undefined) {
      where.roleId = filters.roleId;
    }
    if (filters.scopeType !== undefined) {
      where.scopeType = filters.scopeType;
    }
    if (filters.projectId !== undefined) {
      where.projectId =
        filters.projectId === null ? IsNull() : filters.projectId;
    }
    if (filters.teamId !== undefined) {
      where.teamId = filters.teamId === null ? IsNull() : filters.teamId;
    }

    return this.userRoleAssignmentRepository.find({
      where,
      order: { id: 'ASC' },
    });
  }

  async findByUserId(userId: string): Promise<UserRoleAssignmentEntity[]> {
    this.logger.log({
      log: 'Attempting to list user role assignments by user',
      userId,
    });

    return this.findAssignments({ userId });
  }

  async removeAssignment(id: number): Promise<void> {
    this.logger.log({
      log: 'Attempting to remove user role assignment',
    });
    const exist = await this.userRoleAssignmentRepository.findOne({
      where: { id },
    });

    if (!exist) {
      this.logger.warn({
        log: 'User role assignment not found, skipping deletion',
        id,
      });
      throw new Error('User role assignment not found');
    }
    await this.userRoleAssignmentRepository.delete(id);
  }
}
