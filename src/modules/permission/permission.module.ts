import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { PermissionService } from './permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity])],
  providers: [PermissionService],
  exports: [PermissionService],
})
export class PermissionModule {}
