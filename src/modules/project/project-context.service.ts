import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import { ProjectMemberService } from '@src/modules/project-member/project-member.service';
import UserEntity from '@src/modules/user/user.entity';
import { UserService } from '@src/modules/user/user.service';
import ProjectEntity from './project.entity';
import { ProjectService } from './project.service';

type UseProjectInput = {
  projectId: number;
  userId: string;
};

type CurrentProjectContext = {
  project: ProjectEntity | null;
  projectId: number | null;
  user: UserEntity;
};

type SelectedProjectContext = CurrentProjectContext & {
  project: ProjectEntity;
  projectId: number;
};

@Injectable()
export class ProjectContextService {
  private readonly logger = new Logger(ProjectContextService.name);

  constructor(
    private readonly projectMemberService: ProjectMemberService,
    private readonly projectService: ProjectService,
    private readonly userService: UserService,
  ) {}

  async useProject(input: UseProjectInput): Promise<UserEntity> {
    this.logger.log({
      log: 'Attempting to use project as current project',
      input,
    });

    const user = await this.userService.findById(input.userId);

    if (user == null) {
      throw new NotFoundException('User not found');
    }

    const project = await this.projectService.findById(input.projectId);

    if (project == null) {
      throw new NotFoundException('Project not found');
    }

    await this.validateActiveMembership(input.projectId, input.userId);

    const result = await this.userService.updateCurrentProject(
      user,
      input.projectId,
    );

    this.logger.log({
      log: 'Use project result',
      result: {
        currentProjectId: result.currentProjectId,
        projectId: project.id,
        userId: result.id,
      },
    });

    return result;
  }

  async useProjectByMezonId(
    mezonId: string,
    projectKey: string,
  ): Promise<SelectedProjectContext> {
    this.logger.log({
      log: 'Attempting to use project by mezon id',
      mezonId,
      projectKey,
    });

    const user = await this.findUserByMezonIdOrFail(mezonId);
    const project = await this.findProjectByKeyOrFail(projectKey);

    await this.validateActiveMembership(project.id, user.id);

    const result = await this.userService.updateCurrentProject(
      user,
      project.id,
    );

    this.logger.log({
      log: 'Use project by mezon id result',
      result: {
        currentProjectId: result.currentProjectId,
        mezonId,
        projectId: project.id,
        userId: result.id,
      },
    });

    return {
      project,
      projectId: project.id,
      user: result,
    };
  }

  async getCurrentProject(userId: string): Promise<ProjectEntity | null> {
    this.logger.log({
      log: 'Attempting to get current project',
      userId,
    });

    const user = await this.userService.findById(userId);

    if (user == null) {
      throw new NotFoundException('User not found');
    }

    if (user.currentProjectId == null) {
      this.logger.log({
        log: 'Fallback current project result because user has no current project',
        userId,
      });

      return null;
    }

    const result = await this.projectService.findById(user.currentProjectId);

    this.logger.log({
      log: 'Got current project result',
      result: {
        projectId: result?.id ?? null,
        userId,
      },
    });

    return result;
  }

  async getCurrentProjectByMezonId(
    mezonId: string,
  ): Promise<CurrentProjectContext> {
    this.logger.log({
      log: 'Attempting to get current project by mezon id',
      mezonId,
    });

    const user = await this.findUserByMezonIdOrFail(mezonId);

    if (user.currentProjectId == null) {
      this.logger.log({
        log: 'Fallback current project by mezon id result because user has no current project',
        mezonId,
        userId: user.id,
      });

      return {
        project: null,
        projectId: null,
        user,
      };
    }

    const project = await this.projectService.findById(user.currentProjectId);

    return {
      project,
      projectId: project?.id ?? user.currentProjectId,
      user,
    };
  }

  async getRequiredCurrentProjectByMezonId(
    mezonId: string,
  ): Promise<SelectedProjectContext> {
    const context = await this.getCurrentProjectByMezonId(mezonId);

    if (context.project == null || context.projectId == null) {
      throw new BadRequestException('Current project has not been selected');
    }

    return {
      project: context.project,
      projectId: context.project.id,
      user: context.user,
    };
  }

  async exitProject(userId: string): Promise<UserEntity> {
    this.logger.log({
      log: 'Attempting to exit current project',
      userId,
    });

    const user = await this.userService.findById(userId);

    if (user == null) {
      throw new NotFoundException('User not found');
    }

    const result = await this.userService.updateCurrentProject(user, null);

    this.logger.log({
      log: 'Exit current project result',
      result: {
        currentProjectId: result.currentProjectId,
        userId: result.id,
      },
    });

    return result;
  }

  async exitProjectByMezonId(mezonId: string): Promise<CurrentProjectContext> {
    this.logger.log({
      log: 'Attempting to exit current project by mezon id',
      mezonId,
    });

    const user = await this.findUserByMezonIdOrFail(mezonId);
    const result = await this.userService.updateCurrentProject(user, null);

    this.logger.log({
      log: 'Exit current project by mezon id result',
      result: {
        currentProjectId: result.currentProjectId,
        mezonId,
        userId: result.id,
      },
    });

    return {
      project: null,
      projectId: null,
      user: result,
    };
  }

  private async findProjectByKeyOrFail(
    projectKey: string,
  ): Promise<ProjectEntity> {
    const normalizedProjectKey = projectKey.trim();

    if (!normalizedProjectKey) {
      throw new BadRequestException('Project key is required');
    }

    const project = /^\d+$/.test(normalizedProjectKey)
      ? await this.projectService.findById(Number(normalizedProjectKey))
      : await this.projectService.findBySlug(normalizedProjectKey);

    if (project == null) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async findUserByMezonIdOrFail(mezonId: string): Promise<UserEntity> {
    const user = await this.userService.findByMezonId(mezonId);

    if (user == null) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async validateActiveMembership(
    projectId: number,
    userId: string,
  ): Promise<void> {
    const membership = await this.projectMemberService.findByProjectAndUser(
      projectId,
      userId,
    );

    if (membership?.status === ProjectMemberStatus.ACTIVE) {
      return;
    }

    this.logger.log({
      log: 'Use project failed because user is not an active project member',
      projectId,
      status: membership?.status ?? null,
      userId,
    });

    throw new ForbiddenException('User must be an active project member');
  }
}
