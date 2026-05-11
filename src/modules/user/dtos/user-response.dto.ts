import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRole } from '#src/common/enums/user.enum.js';
import { UserStatus } from '../enum/user-status.enum';

export class UserResponseDto {
  @ApiProperty({ description: 'The unique ID of the user', example: 'uuid-v4' })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'The Mezon-specific ID of the user',
    example: '123456789',
  })
  @Expose()
  mezonId: string;

  @ApiProperty({
    description: 'The display name of the user',
    example: 'John Doe',
    nullable: true,
  })
  @Expose()
  name: string | null;

  @ApiProperty({
    description: 'The email of the user',
    example: 'john@example.com',
    nullable: true,
  })
  @Expose()
  email: string | null;

  @ApiProperty({ description: 'The avatar URL', nullable: true })
  @Expose()
  avatar?: string | null;

  @ApiProperty({
    enum: UserRole,
    description: 'The global role of the user',
    nullable: true,
  })
  @Expose()
  role: UserRole | null;

  @ApiProperty({
    enum: UserStatus,
    description: 'The current status of the user',
    nullable: true,
  })
  @Expose()
  status: UserStatus | null;

  @ApiProperty({
    description: 'The ID of the project the user is currently working on',
    nullable: true,
  })
  @Expose()
  currentProjectId?: string | null;

  @ApiProperty({ description: 'The last activity timestamp', nullable: true })
  @Expose()
  lastActiveAt?: Date | null;

  @ApiProperty({ description: 'Account creation date' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Last account update date' })
  @Expose()
  updatedAt: Date;

  @ApiProperty({ description: 'User ID of the creator', nullable: true })
  @Expose()
  createdBy: string | null;

  @ApiProperty({ description: 'User ID of the last updater', nullable: true })
  @Expose()
  updatedBy: string | null;
}
