import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import ProjectMemberEntity from './project-member.entity';
import { ProjectMemberService } from './project-member.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectMemberEntity])],
  providers: [ProjectMemberService],
  exports: [ProjectMemberService],
})
export class ProjectMemberModule {}
