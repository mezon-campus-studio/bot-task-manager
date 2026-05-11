import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { UserModule } from '@src/modules/user/user.module';
import { ProjectCommandHandler } from './project-command.handler';
import { ProjectContextService } from './project-context.service';
import { ProjectOnboardingService } from './project-onboarding.service';
import ProjectEntity from './project.entity';
import { ProjectService } from './project.service';
import { ProjectV1Controller } from './project.v1.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity]),
    ProjectMemberModule,
    UserModule,
  ],
  controllers: [ProjectV1Controller],
  providers: [
    ProjectCommandHandler,
    ProjectContextService,
    ProjectOnboardingService,
    ProjectService,
  ],
  exports: [ProjectContextService, ProjectService],
})
export class ProjectModule {}
