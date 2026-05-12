import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@src/modules/auth/guards/jwt-auth.guard';
import { PROJECT_DEFAULT_ROLE_KEYS } from '@src/modules/project/constants/project-default-roles.constant';
import { ProjectRoles } from '@src/modules/project/decorators/project-roles.decorator';
import { ProjectMemberGuard } from '@src/modules/project/guards/project-member.guard';
import { ProjectRoleGuard } from '@src/modules/project/guards/project-role.guard';
import { InviteProjectMemberDto } from './dtos/invite-project-member.dto';
import { ProjectMemberService } from './project-member.service';

@Controller('projects/:projectId/members')
@ApiTags('Project Members')
@UseGuards(JwtAuthGuard, ProjectMemberGuard)
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  @Post()
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Invite a member to project' })
  async inviteProjectMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: InviteProjectMemberDto,
  ) {
    return this.projectMemberService.inviteProjectMember({
      ...body,
      projectId,
    });
  }

  @Delete(':userId')
  @UseGuards(ProjectRoleGuard)
  @ProjectRoles(
    PROJECT_DEFAULT_ROLE_KEYS.owner,
    PROJECT_DEFAULT_ROLE_KEYS.admin,
  )
  @ApiOperation({ summary: 'Remove a member from project' })
  async removeProjectMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.projectMemberService.removeProjectMember(projectId, userId);
  }
}
