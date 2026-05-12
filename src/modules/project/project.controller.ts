import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';
import { PROJECT_DEFAULT_ROLE_KEYS } from './constants/project-default-roles.constant';
import { ProjectRoles } from './decorators/project-roles.decorator';
import { ProjectMemberGuard } from './guards/project-member.guard';
import { ProjectRoleGuard } from './guards/project-role.guard';
import { CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectDto } from './dtos/update-project.dto';
import { UseProjectDto } from './dtos/use-project.dto';
import { ProjectContextService } from './project-context.service';
import { ProjectService } from './project.service';

@Controller('projects')
@ApiTags('Projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(
    private readonly projectContextService: ProjectContextService,
    private readonly projectService: ProjectService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  async createProject(@Body() body: CreateProjectDto) {
    return this.projectService.createProject(body);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects (Admin only)' })
  async getProjects() {
    return this.projectService.listProjects();
  }

  @Get('slug/:slug')
  async getProjectBySlug(@Param('slug') slug: string) {
    return this.projectService.findBySlug(slug);
  }

  @Post('use')
  async useProject(@Body() body: UseProjectDto) {
    return this.projectContextService.useProject(body);
  }

  @Get('current/:userId')
  async getCurrentProject(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.projectContextService.getCurrentProject(userId);
  }

  @Delete('current/:userId')
  async exitCurrentProject(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.projectContextService.exitProject(userId);
  }

  @Get(':projectId')
  @UseGuards(ProjectMemberGuard)
  @ApiOperation({ summary: 'Get project by ID' })
  async getProjectById(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectService.findById(id);
  }

  @Patch(':projectId')
  @UseGuards(ProjectMemberGuard, ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Update project' })
  async updateProject(
    @Param('projectId', ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(id, body);
  }

  @Delete(':projectId')
  @UseGuards(ProjectMemberGuard, ProjectRoleGuard)
  @ProjectRoles(PROJECT_DEFAULT_ROLE_KEYS.owner)
  @ApiOperation({ summary: 'Delete project (Owner only)' })
  async deleteProject(@Param('projectId', ParseIntPipe) id: number) {
    return this.projectService.deleteProject(id);
  }
}
