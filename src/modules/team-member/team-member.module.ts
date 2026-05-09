import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import { TeamMemberController } from './team-member.controller';
import { TeamMemberService } from './team-member.service';
import { ProjectModule } from '../project/project.module';
import { TeamModule } from '../team/team.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMemberEntity]),
    TeamModule,
    UserModule,
    ProjectModule,
  ],
  controllers: [TeamMemberController],
  providers: [TeamMemberService],
  exports: [TeamMemberService],
})
export class TeamMemberModule {}
