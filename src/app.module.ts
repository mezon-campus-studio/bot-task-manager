import { Logger, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { MezonClient } from 'mezon-sdk';
import { DatabaseModule } from '@src/common/database/database.module';
import { AppConfigService } from '@src/common/shared/services/app-config.service';
import { SharedModule } from '@src/common/shared/shared.module';
import { NezonModule } from '@src/libs/nezon';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { EventModule } from './modules/event/event.module';
import { NoteModule } from './modules/note/note.module';
import { PermissionModule } from './modules/permission/permission.module';
import { ProjectModule } from './modules/project/project.module';
import { ProjectMemberModule } from './modules/project-member/project-member.module';
import { RoleModule } from './modules/role/role.module';
import { RolePermissionModule } from './modules/role-permission/role-permission.module';
import { TaskModule } from './modules/task/task.module';
import { TeamModule } from './modules/team/team.module';
import { TeamMemberModule } from './modules/team-member/team-member.module';
import { TicketModule } from './modules/ticket/ticket.module';
import { UserModule } from './modules/user/user.module';
import { UserRoleAssignmentModule } from './modules/user-role-assignment/user-role-assignment.module';


@Module({
  imports: [
    SharedModule,
    DatabaseModule,
    NezonModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService) => config.botConfig,
    }),
    EventEmitterModule.forRoot(),
    NestScheduleModule.forRoot(),
    UserModule,
    AuthModule,
    ProjectModule,
    ProjectMemberModule,
    TeamModule,
    TeamMemberModule,
    RoleModule,
    PermissionModule,
    RolePermissionModule,
    UserRoleAssignmentModule,
    TaskModule,
    TicketModule,
    EventModule,
    NoteModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {
  constructor(private mezonClient: MezonClient) {
    this.mezonClient.on('ready', async () => {
      Logger.log('🤖 Mezon Client is ready!');
    });
  }
}
