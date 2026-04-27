import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import TeamEntity from './team.entity';

type CreateTeamInput = Pick<
  TeamEntity,
  'projectId' | 'name' | 'slug' | 'leaderId'
> &
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
    return await this.teamRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const existingTeam = await transactionalEntityManager.findOne(
          TeamEntity,
          {
            where: [
              { projectId: input.projectId, slug: input.slug },
              { projectId: input.projectId, name: input.name },
            ],
          },
        );

        if (existingTeam) {
          throw new ConflictException(
            `Team or slug or name already exists in project ${input.projectId}`,
          );
        }

        if (input.isDefault) {
          await transactionalEntityManager.update(
            TeamEntity,
            { projectId: input.projectId, isDefault: true },
            { isDefault: false },
          );
        }

        const team = transactionalEntityManager.create(TeamEntity, {
          ...input,
          description: input.description ?? null,
          isDefault: input.isDefault ?? false,
        });

        return await transactionalEntityManager.save(team);
      },
    );
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

  async findByLeaderId(leaderId: string): Promise<TeamEntity[]> {
    this.logger.log({
      log: 'Attempting to find teams by leader id',
      leaderId,
    });

    return this.teamRepository.find({
      where: { leaderId },
      order: { id: 'ASC' },
    });
  }

  async findDefaultTeamByProjectId(
    projectId: number,
  ): Promise<TeamEntity | null> {
    this.logger.log({
      log: 'Attempting to find default team by project id',
      projectId,
    });

    return this.teamRepository.findOne({
      where: { projectId, isDefault: true },
    });
  }

  async updateTeam(
    id: number,
    input: Partial<CreateTeamInput>,
  ): Promise<TeamEntity> {
    this.logger.log(`Attempting to update team ID: ${id}`);

    return await this.teamRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const team = await transactionalEntityManager.findOne(TeamEntity, {
          where: { id },
        });
        if (!team) throw new NotFoundException('Team not found');

        if (input.name || input.slug) {
          const duplicate = await transactionalEntityManager.findOne(
            TeamEntity,
            {
              where: [
                {
                  projectId: team.projectId,
                  slug: input.slug ?? team.slug,
                  id: Not(id),
                },
                {
                  projectId: team.projectId,
                  name: input.name ?? team.name,
                  id: Not(id),
                },
              ],
            },
          );

          if (duplicate) {
            throw new ConflictException(
              'New name or slug already exists in this project',
            );
          }
        }

        if (input.isDefault === true) {
          await transactionalEntityManager.update(
            TeamEntity,
            { projectId: team.projectId, isDefault: true },
            { isDefault: false },
          );
        }

        Object.assign(team, input);
        return await transactionalEntityManager.save(team);
      },
    );
  }

  async softDelete(id: number): Promise<void> {
    const result = await this.teamRepository.softDelete(id);
    if (result.affected === 0) {
      throw new NotFoundException(
        `Cannot delete Team with ID ${id} because it does not exist`,
      );
    }
  }
}
