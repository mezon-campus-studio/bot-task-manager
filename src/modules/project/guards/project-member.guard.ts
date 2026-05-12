import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import { ProjectMemberService } from '@src/modules/project-member/project-member.service';

@Injectable()
export class ProjectMemberGuard implements CanActivate {
  constructor(private readonly projectMemberService: ProjectMemberService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    const projectId =
      request.params.projectId ||
      request.body.projectId ||
      request.query.projectId;

    if (!projectId) {
      return true;
    }

    const membership = await this.projectMemberService.findByProjectAndUser(
      Number(projectId),
      user.id,
    );

    if (!membership || membership.status !== ProjectMemberStatus.ACTIVE) {
      throw new ForbiddenException(
        'You are not an active member of this project',
      );
    }

    return true;
  }
}
