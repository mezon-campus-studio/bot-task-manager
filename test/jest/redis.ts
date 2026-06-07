import { env } from 'node:process';

export interface RedisConfig {
  host: string;
  port: number;
}

export function getRedisConfig(): RedisConfig {
  return {
    host: env.REDIS_HOST || 'localhost',
    port: parseInt(env.REDIS_PORT || '6379', 10),
  };
}
