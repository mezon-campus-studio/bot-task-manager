import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ProjectOnboardingStatus } from '../project.enums';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsEnum(ProjectOnboardingStatus)
  onboardingStatus?: ProjectOnboardingStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  onboardingCompletedAt?: Date | null;
}
