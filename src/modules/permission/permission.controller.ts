import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { PermissionService } from './permission.service';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post()
  create(@Body() body: any) {
    return this.permissionService.createPermission(body);
  }

  @Get()
  findAll() {
    return this.permissionService.findAll();
  }

  @Get(':id')
  findById(@Body('id') id: number) {
    return this.permissionService.findById(id);
  }

  @Get('key/:key')
  findByKey(@Body('key') key: string) {
    return this.permissionService.findByKey(key);
  }

  @Put(':id')
  update(@Body() body: any) {
    return this.permissionService.updatePermission(body.id, body);
  }

  @Delete(':id')
  delete(@Body('id') id: number) {
    return this.permissionService.deleteById(id);
  }
}
