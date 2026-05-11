import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRoleAssignmentService } from './user-role-assignment.service';

@ApiTags('User Role Assignments')
@Controller('user-role-assignments')
export class UserRoleAssignmentController {
  constructor(
    private readonly userRoleAssignmentService: UserRoleAssignmentService,
  ) {}

  @Post()
  async assign(@Body() body: any) {
    return this.userRoleAssignmentService.createAssignment(body);
  }

  @Get('user/:userId')
  async getByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.userRoleAssignmentService.findByUserId(userId);
  }

  @Delete(':id')
  async unassign(@Param('id', ParseIntPipe) id: number) {
    return await this.userRoleAssignmentService.removeAssignment(id);
  }
}
