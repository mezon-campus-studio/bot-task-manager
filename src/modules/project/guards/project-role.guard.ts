import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleService } from '@src/modules/role/role.service';
import { UserRoleAssignmentService } from '@src/modules/user-role-assignment/user-role-assignment.service';
import { PROJECT_ROLES_KEY } from '../decorators/project-roles.decorator';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly roleService: RoleService,
    private readonly userRoleAssignmentService: UserRoleAssignmentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

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
      return false;
    }

    const roles = await Promise.all(
      requiredRoles.map((key) => this.roleService.findByKey(key)),
    );
    const roleIds = roles.filter((r) => r !== null).map((r) => r!.id);

    if (roleIds.length === 0) {
      return false;
    }

    const assignments = await this.userRoleAssignmentService.findAssignments({
      projectId: Number(projectId),
      userId: user.id,
    });

    const hasRole = assignments.some((a) => roleIds.includes(a.roleId));

    if (!hasRole) {
      throw new ForbiddenException(
        `You do not have the required roles (${requiredRoles.join(', ')}) in this project`,
      );
    }

    return true;
  }
}
