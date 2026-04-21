import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { PermissionService } from './permission.service';
import { PermissionController } from './permision.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity])],
  providers: [PermissionService],
  controllers:[PermissionController],
  exports: [PermissionService],
})
export class PermissionModule {}
