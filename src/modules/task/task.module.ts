import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { TeamMemberModule } from '@src/modules/team-member/team-member.module';
import { TaskController } from './task.controller';
import TaskEntity from './task.entity';
import { TaskService } from './task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    ProjectMemberModule,
    TeamMemberModule,
  ],
  controllers: [TaskController],
  providers: [TaskService],
  exports: [TaskService],
})
export class TaskModule {}
