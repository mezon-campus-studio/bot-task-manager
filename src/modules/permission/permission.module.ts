import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { AuthModule } from '@src/modules/auth/auth.module';
import { PermissionController } from './permission.controller';
import { PermissionService } from './permission.service';
import { PermissionMessageHandler } from './permission.handler';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity]), AuthModule],
  providers: [PermissionService, PermissionMessageHandler],
  controllers: [PermissionController],
  exports: [PermissionService],
})
export class PermissionModule {}
