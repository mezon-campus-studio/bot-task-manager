import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import UserRoleAssignmentEntity from '@src/modules/user-role-assignment/user-role-assignment.entity';
import { UserRoleAssignmentService } from './user-role-assignment.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserRoleAssignmentEntity])],
  providers: [UserRoleAssignmentService],
  exports: [UserRoleAssignmentService],
})
export class UserRoleAssignmentModule {}
