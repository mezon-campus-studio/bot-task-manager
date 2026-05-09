import { IsDefined, IsInt, IsUUID } from 'class-validator';

export class UseProjectDto {
  @IsDefined()
  @IsUUID()
  userId!: string;

  @IsDefined()
  @IsInt()
  projectId!: number;
}
