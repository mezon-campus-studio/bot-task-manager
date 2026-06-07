import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly BLACKLIST_PREFIX = 'token_blacklist:';

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Add a token to the blacklist in Redis
   * Redis automatically expires the key at token expiration time
   */
  async blacklistToken(
    jti: string,
    expiresAt: Date,
    userId?: string,
    reason?: string,
  ): Promise<void> {
    try {
      const ttl = Math.max(0, expiresAt.getTime() - Date.now());

      // Store token in Redis with automatic expiration (TTL in milliseconds)
      const key = `${this.BLACKLIST_PREFIX}${jti}`;
      const value = {
        userId,
        reason,
        blacklistedAt: new Date().toISOString(),
      };

      await this.cacheManager.set(key, value, ttl);
      this.logger.log(
        `Token ${jti} added to blacklist in Redis (expires in ${Math.round(ttl / 1000)}s)`,
      );
    } catch (error) {
      this.logger.error(`Failed to blacklist token ${jti}:`, error);
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted in Redis
   * Returns true if found, false otherwise
   * O(1) lookup time - very fast
   */
  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${jti}`;
      const value = await this.cacheManager.get(key);
      return !!value;
    } catch (error) {
      this.logger.error(`Failed to check token blacklist for ${jti}:`, error);
      throw error;
    }
  }

  /**
   * Get blacklist info for a specific token
   */
  async getTokenBlacklistInfo(jti: string): Promise<any> {
    try {
      const key = `${this.BLACKLIST_PREFIX}${jti}`;
      return await this.cacheManager.get(key);
    } catch (error) {
      this.logger.error(
        `Failed to get blacklist info for token ${jti}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Cleanup is automatic - Redis TTL handles expiration automatically
   * No cron job needed!
   */
  async getBlacklistStats(): Promise<{
    implementation: string;
    note: string;
  }> {
    return {
      implementation: 'Redis with automatic TTL expiration',
      note: 'Token cleanup is automatic when TTL expires',
    };
  }
}
