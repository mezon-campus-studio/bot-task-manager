import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectModule } from '@src/modules/project/project.module';
import { TicketCommandHandler } from './ticket-command.handler';
import { TicketController } from './ticket.controller';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketEntity]),
    AuthModule,
    ProjectModule,
  ],
  controllers: [TicketController],
  providers: [TicketService, TicketCommandHandler],
  exports: [TicketService],
})
export class TicketModule {}
