import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { RoleScopeType } from './enums/role-scope-type.enum';
import RoleEntity from './role.entity';

type CreateRoleInput = Pick<RoleEntity, 'key' | 'name' | 'scopeType'> &
  Partial<Pick<RoleEntity, 'description' | 'isSystem'>>;

@Injectable()
export class RoleService extends CRUDService<RoleEntity> {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {
    super(roleRepository);
  }

  async createRole(input: CreateRoleInput): Promise<RoleEntity> {
    this.logger.log({
      log: 'Attempting to create role',
      isSystem: input.isSystem ?? false,
      key: input.key,
      scopeType: input.scopeType,
    });

    const role = this.roleRepository.create({
      ...input,
      description: input.description ?? null,
      isSystem: input.isSystem ?? false,
    });

    return this.roleRepository.save(role);
  }

  async findById(id: number): Promise<RoleEntity | null> {
    this.logger.log({
      log: 'Attempting to find role by id',
      roleId: id,
    });

    return this.roleRepository.findOne({ where: { id } });
  }

  async findByKey(key: string): Promise<RoleEntity | null> {
    this.logger.log({
      key,
      log: 'Attempting to find role by key',
    });

    return this.roleRepository.findOne({ where: { key } });
  }

  async findByScopeType(scopeType: RoleScopeType): Promise<RoleEntity[]> {
    this.logger.log({
      log: 'Attempting to list roles by scope',
      scopeType,
    });

    return this.roleRepository.find({
      where: { scopeType },
      order: { id: 'ASC' },
    });
  }
}
