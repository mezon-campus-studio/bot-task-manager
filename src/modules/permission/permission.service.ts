import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import PermissionEntity from './permission.entity';

type CreatePermissionInput = Pick<
  PermissionEntity,
  'key' | 'resource' | 'action'
> &
  Partial<Pick<PermissionEntity, 'description'>>;

@Injectable()
export class PermissionService extends CRUDService<PermissionEntity> {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
  ) {
    super(permissionRepository);
  }

  async createPermission(
    input: CreatePermissionInput,
  ): Promise<PermissionEntity> {
    this.logger.log({
      action: input.action,
      key: input.key,
      log: 'Attempting to create permission',
      resource: input.resource,
    });

    const existed = await this.permissionRepository.findOne({
      where: { key: input.key },
    });
    if (existed) {
      this.logger.warn({
        key: input.key,
        log: 'Permission with the same key already exists',
      });
      throw new Error(`Permission with key ${input.key} already exists`);
    }

    const permission = this.permissionRepository.create({
      ...input,
      description: input.description ?? null,
    });

    return this.permissionRepository.save(permission);
  }

  async findById(id: number): Promise<PermissionEntity | null> {
    this.logger.log({
      log: 'Attempting to find permission by id',
      permissionId: id,
    });

    return this.permissionRepository.findOne({ where: { id } });
  }

  async findByKey(key: string): Promise<PermissionEntity | null> {
    this.logger.log({
      key,
      log: 'Attempting to find permission by key',
    });

    return this.permissionRepository.findOne({ where: { key } });
  }
  async findAll(): Promise<PermissionEntity[]> {
    this.logger.log({
      log: 'Attempting to find all permissions',
    });
    return this.permissionRepository.find();
  }

  async deleteById(id: number): Promise<void> {
    const result = await this.permissionRepository.delete({ id });
    if (result.affected === 0) {
      this.logger.warn({
        log: 'Permission not found',
        permissionId: id,
      });
      throw new Error(`Permission with id ${id} not found`);
    }
    await this.permissionRepository.delete({ id });
  }

  async updatePermission(id: number , input: Partial<CreatePermissionInput>): Promise<PermissionEntity> {
    const permission = await this.findById(id);
    if (!permission) {
      this.logger.warn({
        log: 'Permission not found',
        permissionId: id,
      });
      throw new Error(`Permission with id ${id} not found`);
    }

    if (input.key && input.key !== permission.key) {
      const existed = await this.permissionRepository.findOne({
        where: { key: input.key },
      });
      if (existed) {
        this.logger.warn({
          key: input.key,
          log: 'Permission with the same key already exists',
        });
        throw new Error(`Permission with key ${input.key} already exists`);
      }
    }
    Object.assign(permission, input);
    return this.permissionRepository.save(permission); 
  }
}
