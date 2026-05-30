import { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";
import { RateLimiter } from "./RateLimiter";

/**
 * Sliding Window Log Rate Limiter
 *
 * Analogy: A rolling log of request timestamps. For every incoming request,
 * old entries that fall outside the current window are evicted, and the
 * remaining log length determines whether the request is allowed.
 *
 * Key properties:
 * - Most accurate of all sliding-window algorithms — no approximation.
 * - Higher memory cost: stores one timestamp per request, per user.
 * - Fixes the Fixed Window boundary-burst problem entirely.
 *
 * Example:
 *   maxRequests     = 10        (max requests in any rolling window)
 *   windowInSeconds = 60
 *   At t=75s: evict all timestamps < 75-60=15s, count remaining entries.
 */
export class SlidingWindowLogRateLimiter extends RateLimiter {
    private readonly requestLog = new Map<string, number[]>();

    constructor(config: RateLimitConfig) {
        super(config, RateLimitType.SLIDING_WINDOW_LOG);
    }

    allowRequest(userId: string): boolean {
        const now = Math.floor(Date.now() / 1000);

        let log = this.requestLog.get(userId);

        if (!log) {
            log = [];
            this.requestLog.set(userId, log);
        }

        // remove expired requests
        while (
            log.length > 0 &&
            now - log[0]! >= this.config.windowInSeconds
        ) {
            log.shift();
        }

        if (log.length < this.config.maxRequests) {
            log.push(now);
            return true;
        }

        return false;
    }
}