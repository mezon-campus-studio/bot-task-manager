import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PendingDeletionService } from '@src/common/providers/pending-deletion.service';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { UserModule } from '@src/modules/user/user.module';
import { TicketCommandHandler } from './ticket-command.handler';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketEntity]),
    AuthModule,
    ProjectModule,
    UserModule,
  ],
  providers: [TicketService, TicketCommandHandler, PendingDeletionService],
  exports: [TicketService],
})
export class TicketModule {}
