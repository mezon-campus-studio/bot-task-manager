import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import { RolePermissionController } from './role-permision.controller';
import { RolePermissionService } from './role-permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermissionEntity])],
  providers: [RolePermissionService],
  controllers: [RolePermissionController],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
