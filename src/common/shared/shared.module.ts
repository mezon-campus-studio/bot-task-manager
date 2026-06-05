import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { redisStore } from 'cache-manager-redis-yet';
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
    // In-memory cache for token blacklist (can be upgraded to Redis in production)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        const redisHost = process.env.REDIS_HOST;
        const ttl = 60 * 60 * 24 * 1000; // 24 hours in milliseconds

        if (redisHost) {
          return {
            stores: [
              await redisStore({
                socket: {
                  host: redisHost,
                  port: parseInt(process.env.REDIS_PORT || '6379', 10),
                },
                ttl,
              }),
            ],
            ttl,
          };
        }

        return { ttl };
      },
    }),
  ],
  exports: [...providers, CacheModule],
})
export class SharedModule {}
