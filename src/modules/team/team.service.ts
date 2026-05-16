import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CRUDService } from '@src/common/utils/crud';
import TaskEntity from '@src/modules/task/task.entity';
import TeamMemberEntity from '@src/modules/team-member/team-member.entity';
import TeamEntity from './team.entity';

export type CreateTeamInput = Pick<TeamEntity, 'projectId' | 'name' | 'slug'> &
  Partial<Pick<TeamEntity, 'leaderId' | 'description' | 'isDefault'>> &
  Partial<Pick<TeamEntity, 'createdBy' | 'updatedBy'>>;

export type CreateTeamInProjectInput = Pick<TeamEntity, 'name' | 'slug'> &
  Partial<Pick<TeamEntity, 'leaderId' | 'description' | 'isDefault'>> &
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
          leaderId: input.leaderId ?? null,
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

  async findByProjectAndName(
    projectId: number,
    name: string,
  ): Promise<TeamEntity | null> {
    this.logger.log({
      log: 'Attempting to find team by project name',
      projectId,
      name,
    });

    return this.teamRepository.findOne({
      where: { projectId, name },
    });
  }

  async findByProjectIdentifier(
    projectId: number,
    identifier: string,
  ): Promise<TeamEntity | null> {
    const normalized = identifier.trim();

    if (!normalized) {
      return null;
    }

    const numericId = Number(normalized);
    if (/^[0-9]+$/.test(normalized) && Number.isInteger(numericId)) {
      const team = await this.findById(numericId);
      if (team?.projectId === projectId) {
        return team;
      }
    }

    if (normalized.startsWith('@')) {
      const slug = normalized.slice(1).trim();
      if (slug) {
        const teamBySlug = await this.findByProjectAndSlug(projectId, slug);
        if (teamBySlug) {
          return teamBySlug;
        }
      }
    }

    const teamBySlug = await this.findByProjectAndSlug(projectId, normalized);
    if (teamBySlug) {
      return teamBySlug;
    }

    return this.findByProjectAndName(projectId, normalized);
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

  async createTeamInProject(
    projectId: number,
    input: CreateTeamInProjectInput,
  ): Promise<TeamEntity> {
    this.logger.log({
      log: 'Attempting to create team in current project',
      input,
      projectId,
    });

    return this.createTeam({
      ...input,
      projectId,
    });
  }

  async assignTeamToProject(
    projectId: number,
    teamId: number,
  ): Promise<TeamEntity> {
    this.logger.log({
      log: 'Attempting to assign team to current project',
      projectId,
      teamId,
    });

    const team = await this.findById(teamId);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (team.projectId === projectId) {
      return team;
    }

    return this.teamRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const duplicate = await transactionalEntityManager.findOne(TeamEntity, {
          where: [
            {
              projectId,
              slug: team.slug,
              id: Not(teamId),
            },
            {
              projectId,
              name: team.name,
              id: Not(teamId),
            },
          ],
        });

        if (duplicate) {
          throw new ConflictException(
            'New name or slug already exists in the target project',
          );
        }

        await transactionalEntityManager.update(
          TaskEntity,
          { projectId: team.projectId, teamId },
          { teamId: null },
        );

        team.projectId = projectId;
        team.isDefault = false;

        return transactionalEntityManager.save(TeamEntity, team);
      },
    );
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

        const targetProjectId = input.projectId ?? team.projectId;

        if (input.name || input.slug || input.projectId) {
          const duplicate = await transactionalEntityManager.findOne(
            TeamEntity,
            {
              where: [
                {
                  projectId: targetProjectId,
                  slug: input.slug ?? team.slug,
                  id: Not(id),
                },
                {
                  projectId: targetProjectId,
                  name: input.name ?? team.name,
                  id: Not(id),
                },
              ],
            },
          );

          if (duplicate) {
            throw new ConflictException(
              'New name or slug already exists in the target project',
            );
          }
        }

        if (input.isDefault === true) {
          await transactionalEntityManager.update(
            TeamEntity,
            {
              projectId: targetProjectId,
              isDefault: true,
            },
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

  async deleteTeamFromProject(
    projectId: number,
    teamId: number,
  ): Promise<void> {
    this.logger.log({
      log: 'Attempting to delete team from current project',
      projectId,
      teamId,
    });

    await this.teamRepository.manager.transaction(
      async (transactionalEntityManager) => {
        const team = await transactionalEntityManager.findOne(TeamEntity, {
          where: { id: teamId },
        });

        if (!team) {
          throw new NotFoundException('Team not found');
        }

        if (team.projectId !== projectId) {
          throw new ConflictException(
            `Team ${teamId} does not belong to Project ${projectId}`,
          );
        }

        await transactionalEntityManager.softDelete(TeamMemberEntity, {
          teamId,
        });
        await transactionalEntityManager.update(
          TaskEntity,
          { projectId, teamId },
          { teamId: null },
        );
        await transactionalEntityManager.softDelete(TeamEntity, teamId);
      },
    );
  }

  async setDefaultTeam(projectId: number, teamId: number): Promise<TeamEntity> {
    this.logger.log({
      log: 'Attempting to set default team for project',
      projectId,
      teamId,
    });

    return this.teamRepository.manager.transaction(
      async (transactionalEntityManager) => {
        await transactionalEntityManager.update(
          TeamEntity,
          { projectId, isDefault: true },
          { isDefault: false },
        );

        const team = await transactionalEntityManager.findOne(TeamEntity, {
          where: { id: teamId, projectId },
        });

        if (!team) {
          throw new NotFoundException('Team not found in project');
        }

        team.isDefault = true;
        return transactionalEntityManager.save(team);
      },
    );
  }
}
