import { Controller, Post, Delete, Param, Get, ParseIntPipe, Body } from "@nestjs/common";
import { UserRoleAssignmentService } from "./user-role-assignment.service";

@Controller('user-role-assignments')
export class UserRoleAssignmentController {
  constructor(private readonly userRoleAssignmentService: UserRoleAssignmentService) {} 

  @Post()
  async assign(@Body() Body: any) {
    return this.userRoleAssignmentService.createAssignment(Body);
  }

    @Get('user/:userId')
  async getByUser(@Param('userId') userId: string) {
    return await this.userRoleAssignmentService.findByUserId(userId);
  }
  
  @Delete(':id')
    async unassign(@Param('id', ParseIntPipe) id: number) {
    return await this.userRoleAssignmentService.removeAssignment(id);
  }
}