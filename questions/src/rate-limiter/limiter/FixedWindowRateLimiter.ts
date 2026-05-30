import { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";
import { RateLimiter } from "./RateLimiter";

/**
 * Fixed Window Rate Limiter
 *
 * Analogy: A counter that resets on a clock tick. Time is divided into fixed
 * windows (e.g., every 60 s). Each window has its own fresh counter. Once the
 * counter hits the limit within a window, all further requests are rejected
 * until the next window begins.
 *
 * Key properties:
 * - Simple and memory-efficient — only one counter + one timestamp per user.
 * - Susceptible to boundary bursts: a user can fire maxRequests at the end of
 *   window N and maxRequests again at the start of window N+1, effectively
 *   doubling the allowed rate across the boundary.
 *
 * Example:
 *   maxRequests     = 10        (limit per window)
 *   windowInSeconds = 60
 *   windowIndex     = Math.floor(timestampSec / 60)  → unique bucket per minute
 */
export class FixedWindowRateLimiter extends RateLimiter {
  private readonly requestCount = new Map<string, number>();
  private readonly windowStart = new Map<string, number>();

  constructor(config: RateLimitConfig) {
    super(config, RateLimitType.FIXED_WINDOW);
  }

  allowRequest(userId: string): boolean {
    const currentTimeInSec = Date.now() / 1000;
    const currentReqWindow = Math.floor(
      currentTimeInSec / this.config.windowInSeconds,
    );

    const lastReqWindow = this.windowStart.get(userId) ?? currentReqWindow;

    // window expired -> reset counter and window
    if (lastReqWindow !== currentReqWindow) {
      this.windowStart.set(userId, currentReqWindow);
      this.requestCount.set(userId, 1);
      return true;
    }

    const count = this.requestCount.get(userId) ?? 0;

    if (count < this.config.maxRequests) {
      this.requestCount.set(userId, count + 1);
      return true;
    }

    return false;
  }
}
