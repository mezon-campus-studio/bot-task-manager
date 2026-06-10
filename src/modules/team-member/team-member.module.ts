import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { TeamModule } from '@src/modules/team/team.module';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import { UserModule } from '@src/modules/user/user.module';
import { TeamMemberCommandHandler } from './team-member-command.handler';
import { TeamMemberService } from './team-member.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMemberEntity]),
    forwardRef(() => TeamModule),
    UserModule,
    forwardRef(() => ProjectModule),
    AuthModule,
  ],
  providers: [
    TeamMemberService,
    TeamMemberCommandHandler,
    PendingDeletionService,
  ],
  exports: [TeamMemberService],
})
export class TeamMemberModule {}
