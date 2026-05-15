import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@src/modules/auth/auth.module';
import { ProjectMemberCommandHandler } from '@src/modules/project-member/project-member-command.handler';
import { ProjectMemberModule } from '@src/modules/project-member/project-member.module';
import { UserCommandHandler } from '@src/modules/user/user-command.handler';
import { UserModule } from '@src/modules/user/user.module';
import { ProjectCommandHandler } from './project-command.handler';
import { ProjectContextService } from './project-context.service';
import { ProjectOnboardingService } from './project-onboarding.service';
import { ProjectController } from './project.controller';
import ProjectEntity from './project.entity';
import { ProjectService } from './project.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProjectEntity]),
    ProjectMemberModule,
    UserModule,
    AuthModule,
  ],
  controllers: [ProjectController],
  providers: [
    ProjectCommandHandler,
    ProjectContextService,
    ProjectMemberCommandHandler,
    ProjectOnboardingService,
    ProjectService,
    UserCommandHandler,
  ],
  exports: [ProjectContextService, ProjectService],
})
export class ProjectModule {}
