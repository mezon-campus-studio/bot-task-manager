import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import ProjectEntity from '@src/modules/project/project.entity';
import TaskEntity from '@src/modules/task/task.entity';
import TeamEntity from '@src/modules/team/team.entity';
import TicketEntity from '@src/modules/ticket/ticket.entity';
import UserEntity from '@src/modules/user/user.entity';
import EventEntity from '@src/modules/event/event.entity';
import {
  channelMessage as channelMessageFactory,
  messageButtonClicked as messageButtonClickedFactory,
  event as eventFactory,
  project as projectFactory,
  role as roleFactory,
  task as taskFactory,
  team as teamFactory,
  ticket as ticketFactory,
  user as userFactory,
} from '@src/repl-modules/factories';
import { RoleEntity } from '../modules/role';
import type { ChannelMessage } from 'mezon-sdk';
import type { MessageButtonClicked } from 'mezon-sdk/dist/cjs/rtapi/realtime';

@Injectable()
export class DatabaseSeeder {
  private readonly logger = new Logger(DatabaseSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async seed(options: SeedOptions = {}): Promise<SeedResult> {
    const {
      users = 5,
      user = {},
      tasks = 5,
      task = {},
      tickets = 5,
      ticket = {},
      roles = 3,
      projects = 2,
      project = {},
      teams = 2,
      team = {},
      events = 10, 
      event = {},
    } = options;

    this.logger.log('Starting database seeding...');

    await this.resetDatabase();
    const seededRoles = await this.createRoles(roles);
    const seededUsers = await this.createUsers(users, user);
    const seededProjects = await this.createProjects(projects, {
      ownerUserId: seededUsers[0].id,
      ...project,
    });
    const seededTasks = await this.createTasks(tasks, {
      projectId: seededProjects[0]?.id,
      ...task,
    });
    const seededTickets = await this.createTickets(tickets, {
      projectId: seededProjects[0]?.id,
      ...ticket,
    });
    const seededTeams = await this.createTeams(teams, {
      leaderId: seededUsers[0].id,
      projectId: seededProjects[0]?.id,
      ...team,
    });

    const seededEvents = await createEvents(events, {
      projectId: seededProjects[0]?.id,
      teamId: seededTeams[0]?.id,
      ownerUserId: seededUsers[0].id,
      ...event,
    });

    this.logger.log(`Seeded ${seededEvents.length} events`);
    this.logger.log(`Seeded ${seededUsers.length} users`);
    this.logger.log(`Seeded ${seededProjects.length} projects`);
    this.logger.log(`Seeded ${seededTasks.length} tasks`);
    this.logger.log(`Seeded ${seededTickets.length} tickets`);
    this.logger.log(`Seeded ${seededTeams.length} teams`);

    return {
      roles: seededRoles,
      projects: seededProjects,
      tasks: seededTasks,
      tickets: seededTickets,
      users: seededUsers,
      teams: seededTeams,
      events: seededEvents,
    };
  }

  async createUsers(count = 1, input: Partial<UserEntity> = {}) {
    return userFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }

  async createTasks(count = 1, input: Partial<TaskEntity> = {}) {
    return taskFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }

  async createProjects(count = 1, input: Partial<ProjectEntity> = {}) {
    return projectFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }

  async createTeams(count = 1, input: Partial<TeamEntity> = {}) {
    return teamFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }

  async createTickets(count = 1, input: Partial<TicketEntity> = {}) {
    return ticketFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }

  createBotMessages(count = 1, input: Partial<ChannelMessage> = {}) {
    return Array.from({ length: count }, (_, index) =>
      channelMessageFactory({
        message_id: `message-${index + 1}`,
        ...input,
      }),
    );
  }

  createButtonClicks(count = 1, input: Partial<MessageButtonClicked> = {}) {
    return Array.from({ length: count }, (_, index) =>
      messageButtonClickedFactory({
        button_id: `button-${index + 1}`,
        message_id: `message-${index + 1}`,
        ...input,
      }),
    );
  }

  async truncateUsers() {
    await this.dataSource.getRepository(UserEntity).clear();
  }

  async resetDatabase() {
    const tables = this.dataSource.entityMetadatas
      .filter((entity) => entity.tableType === 'regular')
      .map((entity) => `"${entity.tableName}"`);

    if (tables.length === 0) {
      return;
    }

    await this.dataSource.query(
      `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE;`,
    );
  }
  async createRoles(count = 3, input: Partial<RoleEntity> = {}) {
    return roleFactory(
      Array.from({ length: count }, () => ({
        ...input,
      })),
    );
  }
}

async function createEvents(count = 1, input: Partial<EventEntity> = {}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const mockEvents = Array.from({ length: count }, (_, index) => {
    const startsAt = new Date(today);
    startsAt.setDate(today.getDate() + index); // Each event starts on a different day
    const endAt = new Date(startsAt);
    endAt.setDate(startsAt.getDate() + 1); // Each event lasts for 1 day
    return {
      ...input,
      startsAt,
      endAt,
    };
  });

  return eventFactory(mockEvents);
}


type SeedOptions = {
  task?: Partial<TaskEntity>;
  tasks?: number;
  ticket?: Partial<TicketEntity>;
  tickets?: number;
  users?: number;
  user?: Partial<UserEntity>;
  roles?: number;
  project?: Partial<ProjectEntity>;
  projects?: number;
  teams?: number;
  team?: Partial<TeamEntity>;
  event?: Partial<EventEntity>; // <--- Dùng ở đây
  events?: number;
};

type SeedResult = {
  tasks: TaskEntity[];
  tickets: TicketEntity[];
  users: UserEntity[];
  projects: ProjectEntity[];
  roles: RoleEntity[];
  teams: TeamEntity[];
  events: EventEntity[];
};
