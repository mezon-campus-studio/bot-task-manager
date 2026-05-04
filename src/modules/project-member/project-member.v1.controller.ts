import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InviteProjectMemberDto } from './dtos/invite-project-member.dto';
import { ProjectMemberService } from './project-member.service';

@Controller('projects/:projectId/members')
@ApiTags('Project Members')
export class ProjectMemberV1Controller {
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
}
