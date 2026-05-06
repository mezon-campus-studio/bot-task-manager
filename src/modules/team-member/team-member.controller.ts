import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { AddTeamMemberDto } from './dtos/add-team-member.dto';
import { TeamMemberResponseDto } from './dtos/team-member-response.dto';
import { TeamMemberService } from './team-member.service';

@Controller('team-members')
@UseInterceptors(ClassSerializerInterceptor)
export class TeamMemberController {
  constructor(private readonly teamMemberService: TeamMemberService) {}

  @Post('project/:projectId/team/:teamId')
  async addMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() addTeamMemberDto: AddTeamMemberDto,
  ): Promise<TeamMemberResponseDto> {
    const member = await this.teamMemberService.addMember(
      projectId,
      teamId,
      addTeamMemberDto.userId,
      addTeamMemberDto.invitedBy,
    );
    return plainToInstance(TeamMemberResponseDto, member, {
      excludeExtraneousValues: true,
    });
  }

  @Get('team/:teamId')
  async findByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<TeamMemberResponseDto[]> {
    const members = await this.teamMemberService.findByTeamId(teamId);
    return plainToInstance(TeamMemberResponseDto, members, {
      excludeExtraneousValues: true,
    });
  }

  @Get('team/:teamId/active')
  async findActiveByTeam(
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<TeamMemberResponseDto[]> {
    const members =
      await this.teamMemberService.findActiveMembersByTeamId(teamId);
    return plainToInstance(TeamMemberResponseDto, members, {
      excludeExtraneousValues: true,
    });
  }

  @Get('team/:teamId/user/:userId')
  async findMembership(
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<TeamMemberResponseDto | null> {
    const member = await this.teamMemberService.findMembership(teamId, userId);
    return member
      ? plainToInstance(TeamMemberResponseDto, member, {
          excludeExtraneousValues: true,
        })
      : null;
  }

  @Delete('project/:projectId/team/:teamId/user/:userId')
  @HttpCode(204)
  async removeMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.teamMemberService.removeMember(projectId, teamId, userId);
  }
}
