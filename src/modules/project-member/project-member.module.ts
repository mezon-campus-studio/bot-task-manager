import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberRoleSyncService } from './project-member-role-sync.service';
import ProjectMemberEntity from './project-member.entity';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMemberEntity])],
  providers: [ProjectMemberRoleSyncService, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
