import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectOnboardingService } from './project-onboarding.service';
import ProjectEntity from './project.entity';
import { ProjectService } from './project.service';
import { ProjectV1Controller } from './project.v1.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [ProjectV1Controller],
  providers: [ProjectOnboardingService, ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
