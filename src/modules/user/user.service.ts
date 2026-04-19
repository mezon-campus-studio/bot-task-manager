import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import UserEntity from './user.entity';

type UpsertUserMeta = {
  name?: string;
  email?: string;
  avatar?: string;
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
    });

    const newUser = this.userRepository.create(user);
    const result = await this.userRepository.save(newUser);

    this.logger.log({
      log: 'User creation result',
      result: {
        id: result.id,
        mezonId: result.mezonId,
        email: result.email,
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
      },
    });

    return result;
  }
}
