import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import TeamEntity from '@src/modules/team/team.entity';
import { TeamCommandHandler } from './team-command.handler';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity]),
    ProjectModule,
    AuthModule,
    UserModule,
  ],
  controllers: [TeamController],
  providers: [TeamCommandHandler, TeamService],
  exports: [TeamService],
})
export class TeamModule {}
