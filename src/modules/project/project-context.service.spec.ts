import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { createTestingModule, factory, testingModule } from '#jest';
import { ProjectMemberStatus } from '@src/modules/project-member/project-member-status.enum';
import { TaskService } from '@src/modules/task/task.service';
import { TeamMemberStatus } from '@src/modules/team-member/enums/team-member-status.enum';
import { ProjectContextService } from './project-context.service';
import { ProjectService } from './project.service';

describe(ProjectContextService.name, () => {
  let projectContextService: ProjectContextService;
  let projectService: ProjectService;
  let taskService: TaskService;

  beforeAll(createTestingModule);

  beforeAll(() => {
    projectContextService = testingModule!.get(ProjectContextService);
    projectService = testingModule!.get(ProjectService);
    taskService = testingModule!.get(TaskService);
  });

  async function createProjectWithActiveMember(slug: string) {
    const owner = await factory.user({
      mezonId: `${slug}-owner`,
    });
    const user = await factory.user({
      mezonId: `${slug}-member`,
    });
    const project = await projectService.createProject({
      name: slug.replaceAll('-', ' '),
      ownerUserId: owner.id,
      slug,
    });

    await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.ACTIVE,
      userId: user.id,
    });

    return {
      project,
      user,
    };
  }

  it('sets current project when the user is an active project member', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-use',
    );

    await expect(
      projectContextService.useProject({
        projectId: project.id,
        userId: user.id,
      }),
    ).resolves.toMatchObject({
      currentProjectId: project.id,
      id: user.id,
    });
  });

  it('sets current project by mezon id and project slug', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-use-by-mezon-id',
    );

    await expect(
      projectContextService.useProjectByMezonId(user.mezonId, project.slug),
    ).resolves.toMatchObject({
      projectId: project.id,
      project: {
        id: project.id,
        slug: project.slug,
      },
      user: {
        currentProjectId: project.id,
        id: user.id,
      },
    });
  });

  it('sets current project when the user is an active member of a project team', async () => {
    const owner = await factory.user({
      mezonId: 'project-context-team-owner',
    });
    const user = await factory.user({
      mezonId: 'project-context-team-member',
    });
    const project = await projectService.createProject({
      name: 'project context team',
      ownerUserId: owner.id,
      slug: 'project-context-team',
    });
    const team = await factory.team({
      projectId: project.id,
      slug: 'project-context-team-access',
    });

    await factory.teamMember({
      status: TeamMemberStatus.ACTIVE,
      teamId: team.id,
      userId: user.id,
    });

    await expect(
      projectContextService.useProjectByMezonId(user.mezonId, project.slug),
    ).resolves.toMatchObject({
      projectId: project.id,
      project: {
        id: project.id,
        slug: project.slug,
      },
      user: {
        currentProjectId: project.id,
        id: user.id,
      },
    });
  });

  it('rejects use project when the user does not exist', async () => {
    const project = await factory.project({
      slug: 'project-context-missing-user',
    });

    await expect(
      projectContextService.useProject({
        projectId: project.id,
        userId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects use project when the project does not exist', async () => {
    const user = await factory.user({
      mezonId: 'project-context-missing-project-user',
    });

    await expect(
      projectContextService.useProject({
        projectId: 999_999,
        userId: user.id,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects use project when the user is not an active project member', async () => {
    const project = await factory.project({
      slug: 'project-context-inactive-membership',
    });
    const user = await factory.user({
      mezonId: 'project-context-inactive-membership-user',
    });

    await factory.projectMember({
      projectId: project.id,
      status: ProjectMemberStatus.INVITED,
      userId: user.id,
    });

    await expect(
      projectContextService.useProject({
        projectId: project.id,
        userId: user.id,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the current project when it has been selected', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-current',
    );

    await projectContextService.useProject({
      projectId: project.id,
      userId: user.id,
    });

    await expect(
      projectContextService.getCurrentProject(user.id),
    ).resolves.toMatchObject({
      id: project.id,
      slug: project.slug,
    });
  });

  it('returns the current project by mezon id when it has been selected', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-current-by-mezon-id',
    );

    await projectContextService.useProjectByMezonId(
      user.mezonId,
      String(project.id),
    );

    await expect(
      projectContextService.getRequiredCurrentProjectByMezonId(user.mezonId),
    ).resolves.toMatchObject({
      projectId: project.id,
      project: {
        id: project.id,
        slug: project.slug,
      },
      user: {
        id: user.id,
      },
    });
  });

  it('returns null when the user has no current project', async () => {
    const user = await factory.user({
      mezonId: 'project-context-current-empty-user',
    });

    await expect(
      projectContextService.getCurrentProject(user.id),
    ).resolves.toBeNull();
  });

  it('rejects required current project lookup when the user has not selected a project', async () => {
    const user = await factory.user({
      mezonId: 'project-context-required-empty-user',
    });

    await expect(
      projectContextService.getRequiredCurrentProjectByMezonId(user.mezonId),
    ).rejects.toThrow(BadRequestException);
  });

  it('clears current project when the user exits project context', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-exit',
    );

    await projectContextService.useProject({
      projectId: project.id,
      userId: user.id,
    });

    await expect(
      projectContextService.exitProject(user.id),
    ).resolves.toMatchObject({
      currentProjectId: null,
      id: user.id,
    });
  });

  it('clears current project by mezon id when the user exits project context', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-exit-by-mezon-id',
    );

    await projectContextService.useProjectByMezonId(user.mezonId, project.slug);

    await expect(
      projectContextService.exitProjectByMezonId(user.mezonId),
    ).resolves.toMatchObject({
      project: null,
      projectId: null,
      user: {
        currentProjectId: null,
        id: user.id,
      },
    });
  });

  it('uses current project context to scope task queries by mezon id', async () => {
    const { project, user } = await createProjectWithActiveMember(
      'project-context-task-scope',
    );
    const otherProject = await factory.project({
      slug: 'project-context-task-scope-other',
    });

    const selectedProjectTask = await factory.task({
      projectId: project.id,
      reporterUserId: user.id,
      title: 'Selected project task',
    });

    await factory.task({
      projectId: otherProject.id,
      reporterUserId: user.id,
      title: 'Other project task',
    });

    await projectContextService.useProjectByMezonId(user.mezonId, project.slug);

    const context =
      await projectContextService.getRequiredCurrentProjectByMezonId(
        user.mezonId,
      );
    const result = await taskService.queryTasks(context.projectId, {});

    expect(result).toMatchObject({
      page: 1,
      pageSize: 10,
      total: 1,
    });
    expect(result.result).toHaveLength(1);
    expect(result.result[0]).toMatchObject({
      id: selectedProjectTask.id,
      projectId: project.id,
    });
  });
});
