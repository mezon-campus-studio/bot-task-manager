import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateProjectDto } from './dtos/create-project.dto';
import { UpdateProjectDto } from './dtos/update-project.dto';
import { ProjectService } from './project.service';

@Controller('projects')
@ApiTags('Projects')
export class ProjectV1Controller {
  constructor(private readonly projectService: ProjectService) {}

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
