import { Injectable } from '@nestjs/common';
import TaskEntity from '@src/modules/task/task.entity';
import TicketEntity from '@src/modules/ticket/ticket.entity';
import UserEntity from '@src/modules/user/user.entity';
import { DatabaseSeeder } from '@src/seeders/database.seeder';
import type { ChannelMessage } from 'mezon-sdk';
import type { MessageButtonClicked } from 'mezon-sdk/dist/cjs/rtapi/realtime';

@Injectable()
export class SeederService {
  constructor(private readonly databaseSeeder: DatabaseSeeder) {}

  async seed(options?: {
    task?: Partial<TaskEntity>;
    tasks?: number;
    ticket?: Partial<TicketEntity>;
    tickets?: number;
    users?: number;
    user?: Partial<UserEntity>;
    roles?: number;
  }) {
    return this.databaseSeeder.seed(options);
  }

  async resetDatabase() {
    return this.databaseSeeder.resetDatabase();
  }

  async createUsers(count = 1, input: Partial<UserEntity> = {}) {
    return this.databaseSeeder.createUsers(count, input);
  }

  async createTasks(count = 1, input: Partial<TaskEntity> = {}) {
    return this.databaseSeeder.createTasks(count, input);
  }

  async createTickets(count = 1, input: Partial<TicketEntity> = {}) {
    return this.databaseSeeder.createTickets(count, input);
  }

  createBotMessages(count = 1, input: Partial<ChannelMessage> = {}) {
    return this.databaseSeeder.createBotMessages(count, input);
  }

  createButtonClicks(count = 1, input: Partial<MessageButtonClicked> = {}) {
    return this.databaseSeeder.createButtonClicks(count, input);
  }
}
