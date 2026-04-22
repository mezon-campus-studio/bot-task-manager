import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class GetDetailTicketDto {
  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  id: number;
}
