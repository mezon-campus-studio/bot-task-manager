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
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from '@src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';
import { PROJECT_DEFAULT_ROLE_KEYS } from '@src/modules/project/constants/project-default-roles.constant';
import { ProjectRoles } from '@src/modules/project/decorators/project-roles.decorator';
import { ProjectMemberGuard } from '@src/modules/project/guards/project-member.guard';
import { ProjectRoleGuard } from '@src/modules/project/guards/project-role.guard';
import { ProjectContextService } from '@src/modules/project/project-context.service';
import UserEntity from '@src/modules/user/user.entity';
import { CreateCurrentProjectTeamDto } from './dtos/create-current-project-team.dto';
import { CreateTeamDto } from './dtos/create-team.dto';
import { TeamResponseDto } from './dtos/team-response.dto';
import { UpdateTeamDto } from './dtos/update-team.dto';
import { TeamService } from './team.service';

@ApiTags('Teams')
@Controller('teams')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class TeamController {
  constructor(
    private readonly projectContextService: ProjectContextService,
    private readonly teamService: TeamService,
  ) {}

  @Post()
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Create a new team' })
  async create(
    @CurrentUser() user: UserEntity,
    @Body() createTeamDto: CreateTeamDto,
  ): Promise<TeamResponseDto> {
    const team = await this.teamService.createTeam({
      ...createTeamDto,
      leaderId: createTeamDto.leaderId ?? user.id,
    });
    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Post('current')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({
    summary: "Create a team within the user's current active project",
  })
  async createInCurrentProject(
    @CurrentUser() user: UserEntity,
    @Body() body: CreateCurrentProjectTeamDto,
  ): Promise<TeamResponseDto> {
    const context = await this.projectContextService.getRequiredCurrentProject(
      user.id,
    );
    const team = await this.teamService.createTeamInProject(context.projectId, {
      ...body,
      leaderId: body.leaderId ?? context.user.id,
    });

    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Get('current')
  @ApiOperation({
    summary: "Get all teams in the user's current active project",
  })
  async findByCurrentProject(
    @CurrentUser() user: UserEntity,
  ): Promise<TeamResponseDto[]> {
    const context = await this.projectContextService.getRequiredCurrentProject(
      user.id,
    );
    const teams = await this.teamService.findByProjectId(context.projectId);

    return plainToInstance(TeamResponseDto, teams, {
      excludeExtraneousValues: true,
    });
  }

  @Patch('current/:teamId/assign')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({
    summary: "Assign an existing team to the user's current active project",
  })
  async assignToCurrentProject(
    @CurrentUser() user: UserEntity,
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<TeamResponseDto> {
    const context = await this.projectContextService.getRequiredCurrentProject(
      user.id,
    );
    const team = await this.teamService.assignTeamToProject(
      context.projectId,
      teamId,
    );

    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('current/:teamId')
  @HttpCode(204)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({
    summary: "Remove a team from the user's current active project",
  })
  async removeFromCurrentProject(
    @CurrentUser() user: UserEntity,
    @Param('teamId', ParseIntPipe) teamId: number,
  ): Promise<void> {
    const context = await this.projectContextService.getRequiredCurrentProject(
      user.id,
    );

    await this.teamService.deleteTeamFromProject(context.projectId, teamId);
  }

  @Get('project/:projectId')
  @ApiOperation({ summary: 'Get teams by project ID' })
  async findByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<TeamResponseDto[]> {
    const teams = await this.teamService.findByProjectId(projectId);
    return plainToInstance(TeamResponseDto, teams, {
      excludeExtraneousValues: true,
    });
  }

  @Get('leader/:leaderId')
  @ApiOperation({ summary: 'Get teams by leader ID' })
  async findByLeader(
    @Param('leaderId', ParseUUIDPipe) leaderId: string,
  ): Promise<TeamResponseDto[]> {
    const teams = await this.teamService.findByLeaderId(leaderId);
    return plainToInstance(TeamResponseDto, teams, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get team details' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TeamResponseDto> {
    const team = await this.teamService.findById(id);
    return plainToInstance(TeamResponseDto, team, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update team information' })
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
  @ApiOperation({ summary: 'Soft delete a team' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.teamService.softDelete(id);
  }
}
 plainToInstance(TeamResponseDto, updatedTeam, {
      excludeExtraneousValues: true,
    });
  }

  @Delete('project/:projectId/team/:teamId')
  @HttpCode(204)
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Soft delete a team' })
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('teamId', ParseIntPipe) id: number,
  ): Promise<void> {
    await this.teamService.softDelete(id);
  }
}
