import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RolePermissionService } from './role-permission.service';

@Controller('role-permissions')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Post()
  assign(@Body() body: { roleId: number; permissionId: number }) {
    return this.rolePermissionService.createRolePermission(body);
  }

  @Get('role/:roleId')
  findByRole(@Param('roleId') roleId: string) {
    return this.rolePermissionService.findByRoleId(Number(roleId));
  }

  @Get('permission/:permissionId')
  findByPermission(@Param('permissionId') permissionId: string) {
    return this.rolePermissionService.findByPermissionId(Number(permissionId));
  }
}
