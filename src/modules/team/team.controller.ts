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
  Patch,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CreateTeamDto } from './dtos/create-team.dto';
import { TeamResponseDto } from './dtos/team-response.dto';
import { UpdateTeamDto } from './dtos/update-team.dto';
import { TeamService } from './team.service';

@ApiTags('Teams')
@Controller('teams')
@UseInterceptors(ClassSerializerInterceptor)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  async create(@Body() createTeamDto: CreateTeamDto): Promise<TeamResponseDto> {
    const team = await this.teamService.createTeam(createTeamDto);
    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TeamResponseDto> {
    const team = await this.teamService.findById(id);
    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Get('project/:projectId')
  async findByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<TeamResponseDto[]> {
    const teams = await this.teamService.findByProjectId(projectId);
    return plainToInstance(TeamResponseDto, teams, {
      excludeExtraneousValues: true,
    });
  }

  @Get('leader/:leaderId')
  async findByLeader(
    @Param('leaderId', ParseUUIDPipe) leaderId: string,
  ): Promise<TeamResponseDto[]> {
    const teams = await this.teamService.findByLeaderId(leaderId);
    return plainToInstance(TeamResponseDto, teams, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTeamDto: UpdateTeamDto,
  ): Promise<TeamResponseDto> {
    const updatedTeam = await this.teamService.updateTeam(id, updateTeamDto);
    return plainToInstance(TeamResponseDto, updatedTeam, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.teamService.softDelete(id);
  }
}
