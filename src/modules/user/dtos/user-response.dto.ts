import { Expose } from 'class-transformer';
import { UserRole } from '#src/common/enums/user.enum.js';
import { UserStatus } from '../enum/user-status.enum';

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  mezonId: string;

  @Expose()
  name: string | null;

  @Expose()
  email: string | null;

  @Expose()
  avatar?: string | null;

  @Expose()
  role: UserRole | null;

  @Expose()
  status: UserStatus | null;

  @Expose()
  currentProjectId?: string | null;

  @Expose()
  lastActiveAt?: Date | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;

  @Expose()
  createdBy: string | null;

  @Expose()
  updatedBy: string | null;
}
