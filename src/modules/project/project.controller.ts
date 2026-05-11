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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectDto } from './dtos/update-project.dto';
import { UseProjectDto } from './dtos/use-project.dto';
import { ProjectContextService } from './project-context.service';
import { ProjectService } from './project.service';

@Controller('projects')
@ApiTags('Projects')
export class ProjectController {
  constructor(
    private readonly projectContextService: ProjectContextService,
    private readonly projectService: ProjectService,
  ) {}

  @Post()
  async createProject(@Body() body: CreateProjectDto) {
    return this.projectService.createProject(body);
  }

  @Get()
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

  @Get(':id')
  async getProjectById(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.findById(id);
  }

  @Patch(':id')
  async updateProject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(id, body);
  }

  @Delete(':id')
  async deleteProject(@Param('id', ParseIntPipe) id: number) {
    return this.projectService.deleteProject(id);
  }
}
