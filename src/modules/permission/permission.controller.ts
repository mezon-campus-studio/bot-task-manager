import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionService } from './permission.service';

@ApiTags('Permissions')
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
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.permissionService.findById(id);
  }

  @Get('key/:key')
  findByKey(@Param('key') key: string) {
    return this.permissionService.findByKey(key);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.permissionService.updatePermission(id, body);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.permissionService.deleteById(id);
  }
}
