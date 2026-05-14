import { Logger, Module } from '@nestjs/common';
import { MezonClient } from 'mezon-sdk';
import { BotCronModule } from '@src/bot/cron/bot-cron.module';
import ChannelMessageHandler from '@src/bot/handler/channel-message.handler';
import { DatabaseModule } from '@src/common/database/database.module';
import { AppConfigService } from '@src/common/shared/services/app-config.service';
import { SharedModule } from '@src/common/shared/shared.module';
import { NezonModule } from '@src/libs/nezon';
import { ProjectModule } from '@src/modules/project/project.module';
import { TeamModule } from '@src/modules/team/team.module';
import { RoleModule } from '@src/modules/role/role.module';
import { PermissionModule } from '@src/modules/permission/permission.module';
import { RolePermissionModule } from '@src/modules/role-permission/role-permission.module';
import { NoteModule } from '@src/modules/note/note.module';

@Module({
  imports: [
    SharedModule,
    NezonModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: async (config: AppConfigService) => config.botConfig,
    }),
    DatabaseModule,
    ProjectModule,
    TeamModule,
    TeamMemberModule,
    TicketModule,
    UserModule,
    BotCronModule,
    RoleModule,
    PermissionModule,
    RolePermissionModule,
    NoteModule,
  ],
  providers: [ChannelMessageHandler],
})
export class BotModule {
  private readonly logger = new Logger('BotModule');

  constructor(private mezonClient: MezonClient) {

    this.mezonClient.on('ready', async () => {
      this.logger.log('🤖 Mezon Client is ready!');
    });
  }
}
