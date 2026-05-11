import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { UserModule } from '@src/modules/user/user.module';
import { ProjectOnboardingService } from './project-onboarding.service';
import { ProjectController } from './project.controller';
import ProjectEntity from './project.entity';
import { ProjectCommandHandler } from './project-command.handler';
import { ProjectContextService } from './project-context.service';
import { ProjectService } from './project.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity]),
    ProjectMemberModule,
    UserModule,
  ],
  controllers: [ProjectController],
  providers: [
    ProjectCommandHandler,
    ProjectContextService,
    ProjectOnboardingService,
    ProjectService,
  ],
  exports: [ProjectContextService, ProjectService],
})
export class ProjectModule {}
