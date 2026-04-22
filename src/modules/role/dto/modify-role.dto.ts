import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { RoleScopeType } from '../enums/role-scope-type.enum';
import { PartialType } from '@nestjs/mapped-types';
export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(RoleScopeType)
  scopeType: RoleScopeType;

  @IsString()
  @IsOptional()
  description?: string;
}
export class DeleteRoleDto {
  @IsNumber()
  @IsNotEmpty()
  id: number;
}
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
