import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketController } from './ticket.controller';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TicketEntity]),
    AuthModule,
    ProjectModule,
  ],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}
