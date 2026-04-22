import {
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

export class GetDetailTicketDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}