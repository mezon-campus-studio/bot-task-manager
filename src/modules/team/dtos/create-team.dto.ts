import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ description: 'ID of the project', example: 1 })
  @IsNotEmpty()
  @IsNumber()
  projectId: number;

  @ApiProperty({ description: 'Name of the team', example: 'Backend Team' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Unique slug of the team',
    example: 'backend-team',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  slug: string;

  @ApiPropertyOptional({
    description: 'User ID of the team leader',
    example: 'uuid-v4-string',
  })
  @IsOptional()
  @IsString()
  leaderId?: string;

  @ApiPropertyOptional({
    description: 'Description of the team',
    example: 'The team responsible for server-side logic',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is the default team for the project',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
