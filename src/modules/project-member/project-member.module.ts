import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberRoleSyncService } from './project-member-role-sync.service';
import { ProjectMemberController } from './project-member.controller';
import ProjectMemberEntity from './project-member.entity';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMemberEntity])],
  controllers: [ProjectMemberController],
  providers: [ProjectMemberRoleSyncService, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
