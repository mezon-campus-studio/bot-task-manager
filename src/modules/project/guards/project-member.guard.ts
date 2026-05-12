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

    let projectId =
      request.params.projectId ||
      request.body.projectId ||
      request.query.projectId;

    // Fallback to current project context if projectId is missing in the route
    // This allows routes like /teams/current to pass through if the user has a selected project.
    if (!projectId && user.currentProjectId) {
      projectId = user.currentProjectId;
    }

    // If still no projectId, we allow the request to proceed.
    // The controller or subsequent services will handle the lack of project context.
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
