import { Body, Controller, Get, Param, Post, Delete } from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/modify-role.dto';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get()
    findAll() {
     return this.roleService.findAll();
    }
  @Post()
  create(@Body() dto: CreateRoleDto) {
    return this.roleService.createRole(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.roleService.findById(Number(id));
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.roleService.deleteRole(Number(id));
  }
}