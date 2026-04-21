import { Body, Controller, Get, Post } from '@nestjs/common';
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
}
