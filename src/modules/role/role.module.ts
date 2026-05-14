import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import RoleEntity from '@src/modules/role/role.entity';
import { AuthModule } from '@src/modules/auth/auth.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleMessageHandler } from './role.handler';

@Module({
  imports: [TypeOrmModule.forFeature([RoleEntity]), AuthModule],
  providers: [RoleService, RoleMessageHandler],
  controllers: [RoleController],
  exports: [RoleService],
})
export class RoleModule {}
