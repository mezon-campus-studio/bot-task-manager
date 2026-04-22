import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import RolePermissionEntity from './role-permission.entity';

type CreateRolePermissionInput = Pick<
  RolePermissionEntity,
  'roleId' | 'permissionId'
>;

@Injectable()
export class RolePermissionService extends CRUDService<RolePermissionEntity> {
  private readonly logger = new Logger(RolePermissionService.name);

  constructor(
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
  ) {
    super(rolePermissionRepository);
  }

  async createRolePermission(
    input: CreateRolePermissionInput,
  ): Promise<RolePermissionEntity> {
    this.logger.log({
      log: 'Attempting to create role permission link',
      permissionId: input.permissionId,
      roleId: input.roleId,
    });
    const exist = await this.rolePermissionRepository.findOne({
      where: {
        roleId: input.roleId,
        permissionId: input.permissionId,
      },
    });
    if (exist) {
      return exist;
    }

    const rolePermission = this.rolePermissionRepository.create(input);

    return this.rolePermissionRepository.save(rolePermission);
  }

  async findByRoleId(roleId: number): Promise<RolePermissionEntity[]> {
    this.logger.log({
      log: 'Attempting to list permissions by role',
      roleId,
    });

    return this.rolePermissionRepository.find({
      where: { roleId },
      order: { permissionId: 'ASC' },
    });
  }

  async findByPermissionId(
    permissionId: number,
  ): Promise<RolePermissionEntity[]> {
    this.logger.log({
      log: 'Attempting to list roles by permission',
      permissionId,
    });

    return this.rolePermissionRepository.find({
      where: { permissionId },
      order: { roleId: 'ASC' },
    });
  }

  async deleteByRoleId(roleId: number): Promise<void> {
    this.logger.log({
      log: 'Attempting to delete role permission links by role',
      roleId,
    });

    await this.rolePermissionRepository.delete({ roleId });
  }

  async deleteByPermissionId(permissionId: number): Promise<void> {
    this.logger.log({
      log: 'Attempting to delete role permission links by permission',
      permissionId,
    });

    await this.rolePermissionRepository.delete({ permissionId });
  }

  async removeRolePermission(
    roleId: number,
    permissionId: number,
  ): Promise<void> {
    this.logger.log({
      log: 'Attempting to delete role permission link',
      permissionId,
      roleId,
    });

    await this.rolePermissionRepository.delete({ roleId, permissionId });
  }
}
