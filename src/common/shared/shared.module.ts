import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RateLimiterService } from '@src/common/providers/rate-limiter.service';
import { AppConfigService } from './services/app-config.service';
import { GeneratorService } from './services/generator.service';
import { TokenService } from './services/token.service';
import { ValidatorService } from './services/validator.service';

const providers: Provider[] = [
  AppConfigService,
  ValidatorService,
  GeneratorService,
  TokenService,
  RateLimiterService,
];

@Global()
@Module({
  providers,
  imports: [
    JwtModule.register({}),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  exports: [...providers],
})
export class SharedModule {}
