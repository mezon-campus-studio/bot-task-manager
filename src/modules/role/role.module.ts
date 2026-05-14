import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import RoleEntity from '@src/modules/role/role.entity';
import { RoleCommandHandler } from './role-command.handler';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity]), AuthModule],
  providers: [RoleService, RoleCommandHandler],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
