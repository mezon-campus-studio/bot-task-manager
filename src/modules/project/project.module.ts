import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { UserModule } from '@src/modules/user/user.module';
import { ProjectCommandHandler } from './project-command.handler';
import { ProjectContextService } from './project-context.service';
import { ProjectOnboardingService } from './project-onboarding.service';
import { ProjectController } from './project.controller';
import ProjectEntity from './project.entity';
import { ProjectMemberGuard } from './guards/project-member.guard';
import { ProjectRoleGuard } from './guards/project-role.guard';
import { ProjectService } from './project.service';
import { RoleModule } from '../role/role.module';
import { UserRoleAssignmentModule } from '../user-role-assignment/user-role-assignment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity]),
    forwardRef(() => ProjectMemberModule),
    UserModule,
    RoleModule,
    UserRoleAssignmentModule,
  ],
  controllers: [ProjectController],
  providers: [
    ProjectCommandHandler,
    ProjectContextService,
    ProjectOnboardingService,
    ProjectService,
    ProjectMemberGuard,
    ProjectRoleGuard,
  ],
  exports: [
    ProjectContextService,
    ProjectService,
    ProjectMemberGuard,
    ProjectRoleGuard,
  ],
})
export class ProjectModule {}
