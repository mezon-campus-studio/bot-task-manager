import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectModule } from '@src/modules/project/project.module';
import { AuthModule } from '@src/modules/auth/auth.module';
import TeamEntity from '@src/modules/team/team.entity';
import { TeamCommandHandler } from './team-command.handler';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [TypeOrmModule.forFeature([TeamEntity]), ProjectModule, AuthModule],
  controllers: [TeamController],
  providers: [TeamCommandHandler, TeamService],
  exports: [TeamService],
})
export class TeamModule {}
