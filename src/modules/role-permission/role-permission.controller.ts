import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RolePermissionService } from './role-permission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Role Permissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('role-permissions')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) { }

  @Post()
  assign(@Body() body: { roleId: number; permissionId: number }) {
    return this.rolePermissionService.createRolePermission(body);
  }

  @Get('role/:roleId')
  findByRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.rolePermissionService.findByRoleId(roleId);
  }

  @Get('permission/:permissionId')
  findByPermission(@Param('permissionId', ParseIntPipe) permissionId: number) {
    return this.rolePermissionService.findByPermissionId(permissionId);
  }

  @Delete(':roleId/:permissionId')
  remove(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Param('permissionId', ParseIntPipe) permissionId: number,
  ) {
    return this.rolePermissionService.removeRolePermission(
      roleId,
      permissionId,
    );
  }
}
