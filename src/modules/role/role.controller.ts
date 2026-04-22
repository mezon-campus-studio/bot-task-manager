import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CreateRoleDto } from './dto/modify-role.dto';
import { RoleService } from './role.service';

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

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: CreateRoleDto) {
    return this.roleService.updateRole(Number(id), dto);
  }
}
