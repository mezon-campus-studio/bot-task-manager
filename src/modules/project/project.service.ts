import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import ProjectEntity from './project.entity';
import { ProjectOnboardingStatus } from './project.enums';

type CreateProjectInput = Pick<ProjectEntity, 'name' | 'ownerUserId' | 'slug'> &
  Partial<
    Pick<
      ProjectEntity,
      'description' | 'onboardingCompletedAt' | 'onboardingStatus'
    >
  >;

@Injectable()
export class ProjectService extends CRUDService<ProjectEntity> {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @InjectRepository(ProjectEntity)
    private projectRepository: Repository<ProjectEntity>,
  ) {
    super(projectRepository);
  }

  async createProject(input: CreateProjectInput): Promise<ProjectEntity> {
    this.logger.log({
      log: 'Attempting to create project',
      ownerUserId: input.ownerUserId,
      slug: input.slug,
      onboardingStatus: input.onboardingStatus,
    });

    const project = this.projectRepository.create({
      ...input,
      description: input.description ?? null,
      onboardingCompletedAt: input.onboardingCompletedAt ?? null,
      onboardingStatus:
        input.onboardingStatus ?? ProjectOnboardingStatus.PENDING,
      ownerUser: { id: input.ownerUserId } as never,
    });

    const result = await this.projectRepository.save(project);

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
