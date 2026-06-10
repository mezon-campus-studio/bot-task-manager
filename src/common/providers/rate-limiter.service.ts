import { Injectable, Logger } from '@nestjs/common';

/**
 * In-memory rate limiter for bot commands.
 * Tracks per-user command execution with configurable limits.
 *
 * Implements per-user rate limiting within the Mezon SDK message handler
 * as recommended by Securox (https://owasp.org/www-community/attacks/Brute_force_attack)
 */
@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly userCommandMap = new Map<
    string,
    { count: number; resetTime: number; firstWarningTime?: number }
  >();

  /**
   * Check if a user has exceeded the command rate limit.
   *
   * @param userId - The user ID
   * @param limit - Max commands allowed (default: 10 per minute)
   * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns true if within limit, false if exceeded
   */
  isAllowed(
    userId: string,
    limit: number = 30,
    windowMs: number = 60000,
  ): boolean {
    const now = Date.now();
    const record = this.userCommandMap.get(userId);

    // First request or window expired
    if (!record || now > record.resetTime) {
      this.userCommandMap.set(userId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return true;
    }

    // Increment and check limit
    if (record.count >= limit) {
      this.logger.warn(
        `Rate limit exceeded for user ${userId}. Commands: ${record.count}/${limit} in current window`,
      );
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Check if should notify user about rate limit (only on first exceeding).
   * After first notification, returns false to avoid notification spam.
   *
   * @param userId - The user ID
   * @returns true if this is the first time limit was exceeded, false if already notified
   */
  shouldNotifyLimitExceeded(userId: string): boolean {
    const record = this.userCommandMap.get(userId);
    if (!record) return false;

    const now = Date.now();
    // If window already reset, allow notification again
    if (now > record.resetTime) {
      return true;
    }

    // First time exceeding limit - mark it and notify
    if (!record.firstWarningTime) {
      record.firstWarningTime = now;
      return true;
    }

    // Already notified in this window - don't notify again
    return false;
  }

  /**
   * Get current rate limit status for a user
   *
   * @param userId - The user ID
   * @returns Object with count, limit, and resetTime
   */
  getStatus(userId: string, limit: number = 10) {
    const record = this.userCommandMap.get(userId);
    const now = Date.now();

    if (!record || now > record.resetTime) {
      return {
        count: 0,
        limit,
        resetTime: now + 60000,
      };
    }

    return {
      count: record.count,
      limit,
      resetTime: record.resetTime,
    };
  }

  /**
   * Reset rate limit for a user (for testing/admin purposes)
   *
   * @param userId - The user ID
   */
  reset(userId: string): void {
    this.userCommandMap.delete(userId);
    this.logger.debug(`Rate limit reset for user ${userId}`);
  }

  /**
   * Clear all rate limit records (useful for testing)
   */
  clearAll(): void {
    this.userCommandMap.clear();
    this.logger.debug('All rate limit records cleared');
  }
}
