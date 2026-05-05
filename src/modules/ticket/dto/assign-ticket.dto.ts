import {
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class AssignTicketDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assigneeId?: string | null;
}
