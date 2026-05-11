import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InviteProjectMemberDto } from './dtos/invite-project-member.dto';
import { ProjectMemberService } from './project-member.service';

@Controller('projects/:projectId/members')
@ApiTags('Project Members')
export class ProjectMemberController {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  @Post()
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
  async removeProjectMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.projectMemberService.removeProjectMember(projectId, userId);
  }
}
