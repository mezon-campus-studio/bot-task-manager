import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { PermissionModule } from '@src/modules/permission/permission.module';
import { RoleModule } from '@src/modules/role/role.module';
import RolePermissionEntity from '@src/modules/role-permission/role-permission.entity';
import { RolePermissionCommandHandler } from './role-permission-command.handler';
import { RolePermissionController } from './role-permission.controller';
import { RolePermissionService } from './role-permission.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([RolePermissionEntity]),
    AuthModule,
    RoleModule,
    PermissionModule,
  ],
  providers: [RolePermissionService, RolePermissionCommandHandler],
  controllers: [RolePermissionController],
  exports: [RolePermissionService],
})
export class RolePermissionModule {}
