import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamMemberModule } from '@src/modules/team-member/team-member.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';
import { TaskController } from './task.controller';
import TaskEntity from './task.entity';
import { TaskService } from './task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    TeamMemberModule,
    ProjectModule,
    AuthModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
