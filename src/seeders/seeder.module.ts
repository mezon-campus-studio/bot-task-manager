import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import entities from '@src/common/database/entities';
import { AppConfigService } from '@src/common/shared/services/app-config.service';
import { SharedModule } from '@src/common/shared/shared.module';
import { DatabaseSeeder } from './database.seeder';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SharedModule,
    TypeOrmModule.forRootAsync({
      imports: [SharedModule, ConfigModule],
      useFactory: (configService: AppConfigService) =>
        configService.postgresConfig,
      inject: [AppConfigService],
    }),
    TypeOrmModule.forFeature(entities),
    EventEmitterModule.forRoot(),
  ],
  providers: [DatabaseSeeder],
  exports: [DatabaseSeeder],
})
export class SeederModule {}
