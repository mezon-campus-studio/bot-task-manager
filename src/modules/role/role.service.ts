import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { RoleScopeType } from './enums/role-scope-type.enum';
import RoleEntity from './role.entity';
import { UpdateRoleDto } from './dto/modify-role.dto';

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

    const normalizedKey = input.key.toUpperCase();
    const existed = await this.roleRepository.findOne({
      where: { key: normalizedKey },
    });
    if (existed) {
      this.logger.warn({
        log: 'Role with the same key already exists',
        key: normalizedKey,
      });
      throw new Error(`Role with key ${normalizedKey} already exists`);
    }

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

  // deleteRole //
  async deleteRole(id: number): Promise<void> {
    this.logger.log({
      log: 'Attempting to delete role',
      roleId: id,
    });
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      this.logger.warn({
        log: 'Role not found for deletion',
        roleId: id,
      });
      throw new Error(`Role with id ${id} not found`);
    }
    if (role.isSystem) {
      this.logger.warn({
        log: 'Attempting to delete system role',
        roleId: id,
      });
      throw new Error('System roles cannot be deleted');
    }
    await this.roleRepository.delete(id);
  }
  async findAll(): Promise<RoleEntity[]> {
    this.logger.log({
      log: 'Attempting to list all roles',
    });

    return this.roleRepository.find({
      order: { id: 'ASC' },
    });
  }
  async updateRole(id: number, updates: UpdateRoleDto): Promise<RoleEntity> {
    this.logger.log({
      log: 'Attempting to update role',
      roleId: id,
      updates,
    });
    return this.roleRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const role = await transactionalEntityManager.findOne(RoleEntity, {
          where: { id },
        });
        if (!role) {
          this.logger.warn({
            log: 'Role not found for update',
            roleId: id,
          });
          throw new Error(`Role with id ${id} not found`);
        }
        Object.assign(role, updates);
        return transactionalEntityManager.save(role);
      },
    );
  }
}
