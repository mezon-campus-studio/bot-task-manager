import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import { TeamMemberService } from './team-member.service';
import { ProjectMemberModule } from '../project-member/project-member.module';
import { TeamModule } from '../team/team.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMemberEntity]),
    forwardRef(() => TeamModule),
    forwardRef(() => ProjectMemberModule),
  ],
  providers: [TeamMemberService],
  exports: [TeamMemberService],
})
export class TeamMemberModule {}
