import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberRoleSyncService } from './project-member-role-sync.service';
import ProjectMemberEntity from './project-member.entity';
import { ProjectMemberService } from './project-member.service';
import { ProjectMemberV1Controller } from './project-member.v1.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMemberEntity])],
  controllers: [ProjectMemberV1Controller],
  providers: [ProjectMemberRoleSyncService, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
