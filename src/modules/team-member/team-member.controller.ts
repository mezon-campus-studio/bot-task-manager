import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CreateTeamMemberDto } from './dtos/create-team-member.dto';
import TeamMemberEntity from './team-member.entity';
import { TeamMemberService } from './team-member.service';

@Controller('team-members')
export class TeamMemberController {
  constructor(private readonly teamMemberService: TeamMemberService) {}

  @Post()
  async create(
    @Body() createDto: CreateTeamMemberDto,
  ): Promise<TeamMemberEntity> {
    return this.teamMemberService.createMembership(createDto);
  }

  @Get('team/:teamId')
  async findByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<TeamMemberEntity[]> {
    return this.teamMemberService.findByTeamId(teamId);
  }

  @Get('team/:teamId/active')
  async findActiveByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<TeamMemberEntity[]> {
    return this.teamMemberService.findActiveMembersByTeamId(teamId);
  }
}
