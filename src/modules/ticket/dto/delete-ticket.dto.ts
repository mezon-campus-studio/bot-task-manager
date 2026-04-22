import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class DeleteTicketDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}