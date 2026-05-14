import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { UserRole } from '@src/common/enums/user.enum';
import { CRUDService } from '@src/common/utils/crud';
import { UserStatus } from './enum/user-status.enum';
import UserEntity from './user.entity';

type UpsertUserMeta = {
  name?: string;
  email?: string;
  role?: UserRole;
};

@Injectable()
export class UserService extends CRUDService<UserEntity> {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {
    super(userRepository);
  }

  private async create(user: Partial<UserEntity>) {
    this.logger.log({
      log: 'Attempting to create user',
      mezonId: user.mezonId,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
    });

    const newUser = this.userRepository.create(user);
    const result = await this.userRepository.save(newUser);

    this.logger.log({
      log: 'User creation result',
      result: {
        id: result.id,
        mezonId: result.mezonId,
        email: result.email,
        role: result.role,
        status: result.status,
      },
    });

    return result;
  }

  async getManyByIdsAndUsernames({
    ids,
    mezonIds,
  }: {
    ids?: string[];
    mezonIds?: string[];
  }) {
    this.logger.log({
      log: 'Attempting to get users by identifiers',
      ids,
      mezonIds,
    });

    const orConditions: Array<import('typeorm').FindOptionsWhere<UserEntity>> =
      [];

    if (ids?.length) {
      orConditions.push({ id: In(ids) });
    }

    if (mezonIds?.length) {
      orConditions.push({ mezonId: In(mezonIds) });
    }

    if (orConditions.length === 0) {
      this.logger.log({
        log: 'Fallback to empty user lookup result because no identifiers were provided',
        ids,
        mezonIds,
      });

      return [];
    }

    const result = await this.userRepository.find({ where: orConditions });

    this.logger.log({
      log: 'Got users by identifiers',
      ids,
      mezonIds,
      resultCount: result.length,
    });

    return result;
  }

  async findById(id: string): Promise<UserEntity | null> {
    this.logger.log({
      log: 'Attempting to find user by id',
      id,
    });

    const result = await this.userRepository.findOne({
      where: { id },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback user lookup result because user was not found by id',
        id,
      });

      return null;
    }

    this.logger.log({
      log: 'Got user by id',
      id,
      result: {
        id: result.id,
        mezonId: result.mezonId,
      },
    });

    return result;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    this.logger.log({
      log: 'Attempting to find user by email',
      email,
    });

    const result = await this.userRepository.findOne({
      where: { email },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback user lookup result because user was not found by email',
        email,
      });

      return null;
    }

    this.logger.log({
      log: 'Got user by email',
      email,
      result: {
        id: result.id,
        mezonId: result.mezonId,
      },
    });

    return result;
  }

  async findByMezonId(mezonId: string): Promise<UserEntity | null> {
    this.logger.log({
      log: 'Attempting to find user by mezon id',
      mezonId,
    });

    const result = await this.userRepository.findOne({
      where: { mezonId },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback user lookup result because user was not found by mezon id',
        mezonId,
      });

      return null;
    }

    this.logger.log({
      log: 'Got user by mezon id',
      mezonId,
      result: {
        id: result.id,
        email: result.email,
      },
    });

    return result;
  }

  async upsertByMezonId(
    mezonId: string,
    meta: UpsertUserMeta = {},
  ): Promise<UserEntity> {
    this.logger.log({
      log: 'Attempting to upsert user by mezon id',
      mezonId,
      meta,
    });

    const existingUser = await this.findByMezonId(mezonId);

    if (existingUser == null) {
      this.logger.log({
        log: 'Fallback to user creation because user was not found by mezon id',
        mezonId,
        meta,
      });

      const result = await this.create({ ...meta, mezonId });

      this.logger.log({
        log: 'User upsert result',
        mezonId,
        result: {
          id: result.id,
          mezonId: result.mezonId,
          email: result.email,
          role: result.role,
          status: result.status,
        },
      });

      return result;
    }

    this.logger.log({
      log: 'Got existing user for mezon id upsert',
      mezonId,
      existingUserId: existingUser.id,
    });

    const updatedFields: string[] = [];

    for (const [key, value] of Object.entries(meta)) {
      if (value !== undefined) {
        Object.assign(existingUser, {
          [key]: value,
        });
        updatedFields.push(key);
      }
    }

    const result = await this.userRepository.save(existingUser);

    this.logger.log({
      log: 'User upsert result',
      mezonId,
      updatedFields,
      result: {
        id: result.id,
        mezonId: result.mezonId,
        email: result.email,
        role: result.role,
        status: result.status,
      },
    });

    return result;
  }

  async findByIdentifier(
    identifier: string,
    includeDeleted = false,
  ): Promise<UserEntity | null> {
    const statusFilter = includeDeleted
      ? {}
      : { status: Not(UserStatus.DELETED) };

    const whereConditions: Array<
      import('typeorm').FindOptionsWhere<UserEntity>
    > = [
      { mezonId: identifier, ...statusFilter },
      { name: identifier, ...statusFilter },
      { email: identifier, ...statusFilter },
    ];

    if (this.isUuid(identifier)) {
      whereConditions.unshift({ id: identifier, ...statusFilter });
    }

    return await this.userRepository.findOne({
      where: whereConditions,
      withDeleted: includeDeleted,
    });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  async softDeleteUser(identifier: string): Promise<void> {
    this.logger.log({
      log: 'Attempting to soft delete user by identifier (mezonId,name,email)',
      identifier,
    });

    const existingUser = await this.findByIdentifier(identifier);

    if (!existingUser) {
      this.logger.log({
        log: 'Fallback to no-op because user was not found by identifier for soft delete',
      });
      return;
    }

    if (existingUser.status === UserStatus.DELETED) {
      this.logger.log({
        log: 'Fallback to no-op because user was already marked as deleted',
        mezonId: existingUser.mezonId,
        status: existingUser.status,
      });
      return;
    }

    existingUser.status = UserStatus.DELETED;
    const result = await this.userRepository.save(existingUser);
    await this.userRepository.softRemove(existingUser);

    this.logger.log({
      log: 'Soft delete user result',
      identifier,
      result: {
        id: result.id,
        mezonId: result.mezonId,
        status: result.status,
        deletedAt: result.deletedAt,
      },
    });
  }

  async restoreUser(identifier: string): Promise<void> {
    this.logger.log({
      log: 'Attempting to restore user by identifier (mezonId,name,email)',
      identifier,
    });

    const existingUser = await this.findByIdentifier(identifier, true);

    if (!existingUser) {
      this.logger.log({
        log: 'Fallback to no-op because user was not found by identifier for restore',
      });
      return;
    }

    if (existingUser.status !== UserStatus.DELETED) {
      this.logger.log({
        log: 'Fallback to no-op because user was not marked as deleted',
        mezonId: existingUser.mezonId,
        status: existingUser.status,
      });
      return;
    }

    existingUser.status = UserStatus.ACTIVE;
    const result = await this.userRepository.save(existingUser);
    await this.userRepository.recover(existingUser);

    this.logger.log({
      log: 'Restore user result',
      identifier,
      result: {
        id: result.id,
        mezonId: result.mezonId,
        status: result.status,
        deletedAt: result.deletedAt,
      },
    });
  }

  async updateStatusUser(
    identifier: string,
    status: UserStatus,
  ): Promise<void> {
    this.logger.log({
      log: 'Attempting to update user status by identifier (mezonId,name,email)',
      identifier,
      status,
    });

    const existingUser = await this.findByIdentifier(identifier);

    if (!existingUser) {
      this.logger.log({
        log: 'Fallback to no-op because user was not found by identifier for status update',
      });
      return;
    }

    if (status === UserStatus.DELETED) {
      this.logger.log({
        log: 'Fallback to no-op because you cant change status to deleted',
      });
      return;
    }

    existingUser.status = status;
    const result = await this.userRepository.save(existingUser);

    this.logger.log({
      log: 'Update user status result',
      identifier,
      status,
      result: {
        id: result.id,
        mezonId: result.mezonId,
        status: result.status,
        updateAt: result.updatedAt,
      },
    });
  }

  async updateCurrentProject(
    user: UserEntity,
    currentProjectId: number | null,
  ): Promise<UserEntity> {
    this.logger.log({
      log: 'Attempting to update user current project',
      currentProjectId,
      userId: user.id,
    });

    user.currentProjectId = currentProjectId;
    const result = await this.userRepository.save(user);

    this.logger.log({
      log: 'User current project update result',
      result: {
        currentProjectId: result.currentProjectId,
        id: result.id,
      },
    });

    return result;
  }
}
