import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';

@Module({
  imports: [TypeOrmModule.forFeature([TicketEntity])],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
