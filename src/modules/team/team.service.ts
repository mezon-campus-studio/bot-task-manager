import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import TeamEntity from './team.entity';

type CreateTeamInput = Pick<TeamEntity, 'projectId' | 'name' | 'slug'> &
  Partial<Pick<TeamEntity, 'description' | 'isDefault'>> &
  Partial<Pick<TeamEntity, 'createdBy' | 'updatedBy'>>;

@Injectable()
export class TeamService extends CRUDService<TeamEntity> {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
  ) {
    super(teamRepository);
  }

  async createTeam(input: CreateTeamInput): Promise<TeamEntity> {
    this.logger.log({
      log: 'Attempting to create team',
      isDefault: input.isDefault ?? false,
      projectId: input.projectId,
      slug: input.slug,
    });

    const team = this.teamRepository.create({
      ...input,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? null,
    });

    return this.teamRepository.save(team);
  }

  async findById(id: number): Promise<TeamEntity | null> {
    this.logger.log({
      log: 'Attempting to find team by id',
      teamId: id,
    });

    return this.teamRepository.findOne({ where: { id } });
  }

  async findByProjectId(projectId: number): Promise<TeamEntity[]> {
    this.logger.log({
      log: 'Attempting to list teams by project',
      projectId,
    });

    return this.teamRepository.find({
      where: { projectId },
      order: { id: 'ASC' },
    });
  }

  async findByProjectAndSlug(
    projectId: number,
    slug: string,
  ): Promise<TeamEntity | null> {
    this.logger.log({
      log: 'Attempting to find team by project slug',
      projectId,
      slug,
    });

    return this.teamRepository.findOne({
      where: { projectId, slug },
    });
  }
}
