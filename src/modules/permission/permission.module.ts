import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import PermissionEntity from '@src/modules/permission/permission.entity';
import { PermissionCommandHandler } from './permission-command.handler';
import { PermissionService } from './permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity]), AuthModule],
  providers: [
    PermissionService,
    PermissionCommandHandler,
    PendingDeletionService,
  ],
  exports: [PermissionService],
})
export class PermissionModule {}
