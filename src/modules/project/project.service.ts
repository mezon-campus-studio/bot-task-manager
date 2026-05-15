import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import { ProjectOnboardingService } from './project-onboarding.service';
import ProjectEntity from './project.entity';
import { ProjectOnboardingStatus } from './project.enums';

type CreateProjectInput = Pick<ProjectEntity, 'name' | 'ownerUserId' | 'slug'> &
  Partial<Pick<ProjectEntity, 'description'>>;

type UpdateProjectInput = Partial<
  CreateProjectInput &
    Pick<ProjectEntity, 'onboardingCompletedAt' | 'onboardingStatus'>
>;

@Injectable()
export class ProjectService extends CRUDService<ProjectEntity> {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private projectRepository: Repository<ProjectEntity>,
    private readonly projectOnboardingService: ProjectOnboardingService,
  ) {
    super(projectRepository);
  }

  async createProject(input: CreateProjectInput): Promise<ProjectEntity> {
    this.logger.log({
      log: 'Attempting to create project',
      ownerUserId: input.ownerUserId,
      slug: input.slug,
    });

    const result = await this.projectRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const existingProject = await transactionalEntityManager.findOne(
          ProjectEntity,
          {
            where: { slug: input.slug },
          },
        );

        if (existingProject != null) {
          this.logger.log({
            log: 'Project creation failed because slug already exists',
            existingProjectId: existingProject.id,
            slug: input.slug,
          });

          throw new ConflictException(
            `Project with slug ${input.slug} already exists`,
          );
        }

        const project = transactionalEntityManager.create(ProjectEntity, {
          ...input,
          description: input.description ?? null,
          onboardingCompletedAt: null,
          onboardingStatus: ProjectOnboardingStatus.IN_PROGRESS,
          ownerUser: { id: input.ownerUserId } as never,
        });

        const createdProject = await transactionalEntityManager.save(project);

        await this.projectOnboardingService.initializeProjectDefaults(
          createdProject,
          transactionalEntityManager,
        );

        createdProject.onboardingCompletedAt = new Date();
        createdProject.onboardingStatus = ProjectOnboardingStatus.COMPLETED;

        return transactionalEntityManager.save(createdProject);
      },
    );

    this.logger.log({
      log: 'Project creation result',
      result: {
        id: result.id,
        ownerUserId: result.ownerUserId,
        slug: result.slug,
        onboardingStatus: result.onboardingStatus,
      },
    });

    return result;
  }

  async listProjects(): Promise<ProjectEntity[]> {
    this.logger.log({
      log: 'Attempting to list projects',
    });

    const result = await this.projectRepository.find({
      order: {
        id: 'DESC',
      },
    });

    this.logger.log({
      log: 'Got projects result',
      count: result.length,
      projectIds: result.map(({ id }) => id),
    });

    return result;
  }

  async findByOwnerUserId(ownerUserId: string): Promise<ProjectEntity[]> {
    this.logger.log({
      log: 'Attempting to find projects by owner user id',
      ownerUserId,
    });

    return this.projectRepository.find({
      where: { ownerUserId },
      order: { id: 'DESC' },
    });
  }

  async findById(id: number): Promise<ProjectEntity | null> {
    this.logger.log({
      log: 'Attempting to find project by id',
      id,
    });

    const result = await this.projectRepository.findOne({
      where: { id },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback project lookup result because project was not found by id',
        id,
      });

      return null;
    }

    this.logger.log({
      log: 'Got project by id',
      id,
      result: {
        id: result.id,
        slug: result.slug,
        ownerUserId: result.ownerUserId,
      },
    });

    return result;
  }

  async updateProject(
    projectId: number,
    input: UpdateProjectInput,
  ): Promise<ProjectEntity | null> {
    this.logger.log({
      log: 'Attempting to update project',
      projectId,
      input,
    });

    const project = await this.findById(projectId);

    if (project == null) {
      this.logger.log({
        log: 'Fallback project update result because project was not found',
        projectId,
      });

      return null;
    }

    Object.assign(project, input);

    if (input.slug != null) {
      const duplicateProject = await this.projectRepository.findOne({
        where: {
          id: Not(projectId),
          slug: input.slug,
        },
      });

      if (duplicateProject != null) {
        this.logger.log({
          log: 'Project update failed because slug already exists',
          duplicateProjectId: duplicateProject.id,
          projectId,
          slug: input.slug,
        });

        throw new ConflictException(
          `Project with slug ${input.slug} already exists`,
        );
      }
    }

    if (input.ownerUserId != null) {
      project.ownerUser = { id: input.ownerUserId } as never;
    }

    const result = await this.projectRepository.save(project);

    this.logger.log({
      log: 'Project update result',
      projectId,
      result: {
        id: result.id,
        ownerUserId: result.ownerUserId,
        slug: result.slug,
        onboardingStatus: result.onboardingStatus,
      },
    });

    return result;
  }

  async deleteProject(projectId: number): Promise<boolean> {
    this.logger.log({
      log: 'Attempting to delete project',
      projectId,
    });

    const project = await this.findById(projectId);

    if (project == null) {
      this.logger.log({
        log: 'Fallback project delete result because project was not found',
        projectId,
      });

      return false;
    }

    await this.projectRepository.softRemove(project);

    this.logger.log({
      log: 'Project delete result',
      projectId,
    });

    return true;
  }

  async findBySlug(slug: string): Promise<ProjectEntity | null> {
    this.logger.log({
      log: 'Attempting to find project by slug',
      slug,
    });

    const result = await this.projectRepository.findOne({
      where: { slug },
    });

    if (result == null) {
      this.logger.log({
        log: 'Fallback project lookup result because project was not found by slug',
        slug,
      });

      return null;
    }

    this.logger.log({
      log: 'Got project by slug',
      slug,
      result: {
        id: result.id,
        ownerUserId: result.ownerUserId,
      },
    });

    return result;
  }
}
