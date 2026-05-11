import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateRoleDto } from './dto/modify-role.dto';
import { RoleService } from './role.service';

@ApiTags('Roles')
@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) { }

  @Get()
  findAll() {
    return this.roleService.findAll();
  }

  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.createRole(dto);
  }

  @Get(':id')
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findById(id);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.deleteRole(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateRoleDto) {
    return this.roleService.updateRole(id, dto);
  }
}
