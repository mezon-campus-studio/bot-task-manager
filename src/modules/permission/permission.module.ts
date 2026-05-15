import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { PermissionCommandHandler } from './permission-command.handler';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity]), AuthModule],
  providers: [PermissionService, PermissionCommandHandler],
  controllers: [PermissionController],
  exports: [PermissionService],
})
export class PermissionModule {}
