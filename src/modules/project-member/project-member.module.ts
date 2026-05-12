import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberRoleSyncService } from './project-member-role-sync.service';
import { ProjectMemberController } from './project-member.controller';
import ProjectMemberEntity from './project-member.entity';
import { ProjectMemberService } from './project-member.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { forwardRef } from '@nestjs/common';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectMemberEntity]),
    forwardRef(() => ProjectModule),
    AuthModule,
  ],
  controllers: [ProjectMemberController],
  providers: [ProjectMemberRoleSyncService, ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
