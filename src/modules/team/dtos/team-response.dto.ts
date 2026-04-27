import { Expose } from 'class-transformer';

export class TeamResponseDto {
  @Expose()
  id: number;

  @Expose()
  projectId: number;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  leaderId: string;

  @Expose()
  description: string | null;

  @Expose()
  isDefault: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
