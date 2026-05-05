import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import TicketEntity from './ticket.entity';
import { TicketService } from './ticket.service';
import { TicketAssignmentValidatorService } from './ticket-assignment-validator.service';
import UserEntity from '@src/modules/user/user.entity';
import ProjectEntity from '@src/modules/project/project.entity';
import ProjectMemberEntity from '@src/modules/project-member/project-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketEntity,
      UserEntity,
      ProjectEntity,
      ProjectMemberEntity,
    ]),
  ],
  providers: [TicketService, TicketAssignmentValidatorService],
  exports: [TicketService],
})
export class TicketModule {}
