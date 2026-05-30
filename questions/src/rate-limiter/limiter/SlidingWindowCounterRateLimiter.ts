
import { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";
import { RateLimiter } from "./RateLimiter";

/**
 * Sliding Window Counter Rate Limiter
 *
 * A memory-efficient approximation of the Sliding Window Log.
 * Instead of storing every timestamp, it keeps only two counters:
 *   - prevCount: requests in the previous fixed window
 *   - currCount: requests in the current fixed window
 *
 * The estimated count for the rolling window is computed as:
 *
 *   estimate = prevCount * (1 - overlap) + currCount
 *
 * where `overlap` is the fraction of the current window that has elapsed.
 *
 * Example:
 *   windowInSeconds = 60, maxRequests = 10
 *   At t=75s (15s into the current window, overlap = 15/60 = 0.25):
 *     prevCount = 8, currCount = 3
 *     estimate  = 8 * (1 - 0.25) + 3 = 6 + 3 = 9  → under limit → ALLOW
 */
export class SlidingWindowCounterRateLimiter extends RateLimiter {
    // Count of requests in the previous window
    private readonly prevCount = new Map<string, number>();
    // Count of requests in the current window
    private readonly currCount = new Map<string, number>();
    // The window index (bucket ID) for the current window
    private readonly currWindow = new Map<string, number>();

    constructor(config: RateLimitConfig) {
        super(config, RateLimitType.SLIDING_WINDOW_COUNTER);
    }

    allowRequest(userId: string): boolean {
        const nowSec = Date.now() / 1000;
        const windowSize = this.config.windowInSeconds;

        // Current fixed-window bucket index (same arithmetic as FixedWindowRateLimiter)
        const currentWindowIndex = Math.floor(nowSec / windowSize);

        const lastWindow = this.currWindow.get(userId);

        if (lastWindow === undefined) {
            // First request ever for this user
            this.currWindow.set(userId, currentWindowIndex);
            this.prevCount.set(userId, 0);
            this.currCount.set(userId, 0);
        } else if (currentWindowIndex === lastWindow + 1) {
            // Rolled over exactly one window: current becomes previous
            this.prevCount.set(userId, this.currCount.get(userId) ?? 0);
            this.currCount.set(userId, 0);
            this.currWindow.set(userId, currentWindowIndex);
        } else if (currentWindowIndex > lastWindow + 1) {
            // Rolled over more than one window: no useful history remains
            this.prevCount.set(userId, 0);
            this.currCount.set(userId, 0);
            this.currWindow.set(userId, currentWindowIndex);
        }
        // else: same window — nothing to rotate

        // Fraction of the current window that has already elapsed (0.0 – 1.0)
        const elapsedFraction = (nowSec % windowSize) / windowSize;

        // Weighted estimate of requests in the rolling window
        const prev = this.prevCount.get(userId) ?? 0;
        const curr = this.currCount.get(userId) ?? 0;
        const estimate = prev * (1 - elapsedFraction) + curr;

        if (estimate < this.config.maxRequests) {
            this.currCount.set(userId, curr + 1);
            return true;
        }

        return false;
    }
}
