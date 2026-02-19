import { env } from '../config/env.ts'
import { getLogger } from '../utils/logger.ts'

/**
 * Single-owner access guard.
 * All interactions must pass through this guard before being processed.
 */
class AuthGuard {
  private readonly logger = getLogger()
  private readonly allowedUserId: string

  constructor(allowedUserId: string) {
    this.allowedUserId = allowedUserId
  }

  isAllowed(userId: string): boolean {
    const allowed = userId === this.allowedUserId
    if (!allowed) {
      this.logger.warn('Access denied', { userId, expected: this.allowedUserId })
    }
    return allowed
  }

  assertAllowed(userId: string): void {
    if (!this.isAllowed(userId)) {
      throw new Error(`Access denied for user ${userId}`)
    }
  }
}

export const authGuard = new AuthGuard(env.ALLOWED_USER_ID)
