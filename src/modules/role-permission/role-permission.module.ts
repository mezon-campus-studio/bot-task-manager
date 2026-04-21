import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import { RolePermissionService } from './role-permission.service';
import { RolePermissionController } from './role-permision.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RolePermissionEntity])],
  providers: [RolePermissionService],
  controllers: [RolePermissionController],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
