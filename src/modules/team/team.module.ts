import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import TeamEntity from '@src/modules/team/team.entity';
import { TeamCommandHandler } from './team-command.handler';
import { TeamService } from './team.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity]),
    forwardRef(() => ProjectModule),
    AuthModule,
    UserModule,
  ],
  providers: [TeamCommandHandler, TeamService, PendingDeletionService],
  exports: [TeamService],
})
export class TeamModule {}
