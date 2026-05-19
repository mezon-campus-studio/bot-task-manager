import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
  providers: [TeamCommandHandler, TeamService],
  exports: [TeamService],
})
export class TeamModule {}
