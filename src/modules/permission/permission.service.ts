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
}
