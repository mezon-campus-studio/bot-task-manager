//Dùng cho Get Detail và Delete.

import { IsUUID } from 'class-validator';

export class EventParamsDto {
  @IsUUID()
  id: string;
}