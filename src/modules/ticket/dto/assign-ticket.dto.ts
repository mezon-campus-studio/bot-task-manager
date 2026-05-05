import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class AssignTicketDto {
  @IsUUID()
  @IsNotEmpty()
  assigneeUserId: string;
}
