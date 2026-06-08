import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import RoleEntity from '@src/modules/role/role.entity';
import { RoleCommandHandler } from './role-command.handler';
import { RoleService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity]), AuthModule],
  providers: [RoleService, RoleCommandHandler, PendingDeletionService],
  exports: [RoleService],
})
export class RoleModule {}
