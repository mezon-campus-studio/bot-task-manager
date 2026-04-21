import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { RoleScopeType } from "../enums/role-scope-type.enum";
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
export class UpdateRoleDto {
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