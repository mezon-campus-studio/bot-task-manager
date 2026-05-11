import { IsNotEmpty, IsUUID, IsNumberString } from 'class-validator';

// Dùng cho: GET /tickets/project/:projectId
// Dùng để đảm bảo mọi thao tác đều nằm trong phạm vi một Project cụ thể
export class TicketScopeParamsDto {
  @IsNumberString()
  @IsNotEmpty()
  projectId: string;
}

// Dùng cho: GET/PATCH/DELETE /tickets/:id
export class TicketIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  id: string;
}