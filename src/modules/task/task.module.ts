import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { TeamMemberModule } from '@src/modules/team-member/team-member.module';
import { UserModule } from '@src/modules/user/user.module';
import { TaskCommandHandler } from './task-command.handler';
import { TaskController } from './task.controller';
import TaskEntity from './task.entity';
import { TaskService } from './task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TaskEntity]),
    AuthModule,
    ProjectModule,
    ProjectMemberModule,
    TeamMemberModule,
    UserModule,
  ],
  controllers: [TaskController],
  providers: [TaskCommandHandler, TaskService],
  exports: [TaskService],
})
export class TaskModule {}
