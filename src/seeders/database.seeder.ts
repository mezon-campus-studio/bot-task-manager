import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import TaskEntity from '@src/modules/task/task.entity';
import TicketEntity from '@src/modules/ticket/ticket.entity';
import UserEntity from '@src/modules/user/user.entity';
import {
  channelMessage as channelMessageFactory,
  messageButtonClicked as messageButtonClickedFactory,
  role as roleFactory,
  task as taskFactory,
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
    } = options;

    this.logger.log('Starting database seeding...');

    await this.resetDatabase();
    const seededRoles = await this.createRoles(roles);
    const seededUsers = await this.createUsers(users, user);
    const seededTasks = await this.createTasks(tasks, task);
    const seededTickets = await this.createTickets(tickets, ticket);

    this.logger.log(`Seeded ${seededUsers.length} users`);
    this.logger.log(`Seeded ${seededTasks.length} tasks`);
    this.logger.log(`Seeded ${seededTickets.length} tickets`);

    return {
      roles: seededRoles,
      tasks: seededTasks,
      tickets: seededTickets,
      users: seededUsers,
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

type SeedOptions = {
  task?: Partial<TaskEntity>;
  tasks?: number;
  ticket?: Partial<TicketEntity>;
  tickets?: number;
  users?: number;
  user?: Partial<UserEntity>;
  roles?: number;
};

type SeedResult = {
  tasks: TaskEntity[];
  tickets: TicketEntity[];
  users: UserEntity[];
  roles: RoleEntity[];
};
