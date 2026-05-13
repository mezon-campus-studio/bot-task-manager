import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { TeamModule } from '@src/modules/team/team.module';
import { UserModule } from '@src/modules/user/user.module';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import { TeamMemberCommandHandler } from './team-member-command.handler';
import { TeamMemberController } from './team-member.controller';
import { TeamMemberService } from './team-member.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMemberEntity]),
    TeamModule,
    UserModule,
    ProjectModule,
    AuthModule,
  ],
  controllers: [TeamMemberController],
  providers: [TeamMemberService, TeamMemberCommandHandler],
  exports: [TeamMemberService],
})
export class TeamMemberModule {}
