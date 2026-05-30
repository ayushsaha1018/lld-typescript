
import { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";
import { RateLimiter } from "./RateLimiter";

/**
 * Leaky Bucket Rate Limiter
 *
 * Analogy: A bucket with a hole at the bottom. Requests fill the bucket from
 * the top. Water (requests) leaks out at a fixed rate. If the bucket overflows
 * (queue is full), new requests are dropped.
 *
 * Key properties:
 * - Smooths out bursty traffic into a steady output stream.
 * - Unlike Token Bucket, it does NOT allow bursts to pass through immediately.
 * - Queue capacity = maxRequests, outflow = 1 request per leakRate seconds.
 *
 * Example:
 *   maxRequests    = 10         (bucket / queue capacity)
 *   windowInSeconds = 60
 *   leakRate       = 60 / 10 = 6 seconds per request leaked out
 */
export class LeakyBucketRateLimiter extends RateLimiter {
    // queue of pending request timestamps (ms) per user
    private readonly queue = new Map<string, number[]>();
    private readonly lastLeakTime = new Map<string, number>();

    constructor(config: RateLimitConfig) {
        super(config, RateLimitType.LEAKY_BUCKET);
    }

    allowRequest(userId: string): boolean {
        const now = Date.now();

        // Initialise on first encounter
        if (!this.lastLeakTime.has(userId)) {
            this.lastLeakTime.set(userId, now);
            this.queue.set(userId, []);
        }

        this.leak(userId, now);

        const userQueue = this.queue.get(userId)!;

        if (userQueue.length < this.config.maxRequests) {
            userQueue.push(now);
            return true;
        }

        // Bucket overflows — drop the request
        return false;
    }

    /**
     * Drains requests from the front of the queue based on elapsed time.
     * leakRate = windowInSeconds / maxRequests  (seconds per request)
     */
    private leak(userId: string, now: number): void {
        const leakRate =
            this.config.windowInSeconds / this.config.maxRequests;

        const lastLeak = this.lastLeakTime.get(userId)!;
        const elapsedSeconds = (now - lastLeak) / 1000;

        // How many requests have leaked out since last check
        const leaked = Math.floor(elapsedSeconds / leakRate);

        if (leaked > 0) {
            const userQueue = this.queue.get(userId)!;
            // Remove `leaked` requests from the front (they have been processed)
            userQueue.splice(0, leaked);

            // Advance lastLeakTime by exact token boundaries to preserve remainder
            this.lastLeakTime.set(
                userId,
                lastLeak + leaked * leakRate * 1000,
            );
        }
    }
}
