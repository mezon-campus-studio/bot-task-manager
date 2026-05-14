import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import { AuthModule } from '@src/modules/auth/auth.module';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionMessageHandler } from './role-permission.handler';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermissionEntity]), AuthModule],
  providers: [RolePermissionService, RolePermissionMessageHandler],
  controllers: [RolePermissionController],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
