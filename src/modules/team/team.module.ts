import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TeamEntity from '@src/modules/team/team.entity';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { TeamMemberModule } from '../team-member';

@Module({
  imports: [
    TypeOrmModule.forFeature([TeamEntity]),
    forwardRef(() => TeamMemberModule),
  ],
  controllers: [TeamController],
  providers: [TeamService],
  exports: [TeamService],
})
export class TeamModule {}
