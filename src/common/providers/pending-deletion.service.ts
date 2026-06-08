import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

const PENDING_DELETION_KEY_PREFIX = 'pending:delete:';
const PENDING_DELETION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Shared service for enforcing a pending-deletion confirmation gate.
 *
 * Modules with delete+confirm-delete command patterns (note, permission,
 * project, role, task, team, ticket, user) use this service to prevent
 * *confirm delete from being invoked directly, bypassing the safety check.
 *
 * Flow:
 *  1. *delete sets a pending flag (5-min TTL) and shows a confirmation prompt.
 *  2. *confirm delete verifies the flag exists before proceeding.
 *  3. Calling *confirm delete without step 1 is rejected.
 */
@Injectable()
export class PendingDeletionService {
  private readonly logger = new Logger(PendingDeletionService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Set a pending-deletion flag for the given resource identifier.
   * Uses a composite key to avoid collisions across different modules.
   * The flag expires after 5 minutes.
   */
  async setPendingDeletion(
    module: string,
    resourceIdentifier: string,
  ): Promise<void> {
    const key = this.buildKey(module, resourceIdentifier);
    await this.cache.set(key, '1', PENDING_DELETION_TTL_MS);
    this.logger.log(
      `Pending deletion flag set | module=${module} id="${resourceIdentifier}"`,
    );
  }

  /**
   * Check whether a pending-deletion flag exists and has not expired.
   */
  async hasPendingDeletion(
    module: string,
    resourceIdentifier: string,
  ): Promise<boolean> {
    const key = this.buildKey(module, resourceIdentifier);
    const value = await this.cache.get(key);
    return value != null;
  }

  /**
   * Clear the pending-deletion flag (e.g. after successful deletion).
   */
  async clearPendingDeletion(
    module: string,
    resourceIdentifier: string,
  ): Promise<void> {
    const key = this.buildKey(module, resourceIdentifier);
    await this.cache.del(key);
    this.logger.log(
      `Pending deletion flag cleared | module=${module} id="${resourceIdentifier}"`,
    );
  }

  private buildKey(module: string, resourceIdentifier: string): string {
    const normalizedModule = module.trim().toLowerCase();
    const normalizedId = resourceIdentifier.trim().toLowerCase();
    return `${PENDING_DELETION_KEY_PREFIX}${normalizedModule}:${normalizedId}`;
  }
}
