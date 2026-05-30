
import { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";
import { RateLimiter } from "./RateLimiter";

/**
 * Token Bucket Rate Limiter
 *
 * Analogy: A bucket that holds tokens. Each incoming request consumes one
 * token. Tokens are refilled at a fixed rate over time. If the bucket is
 * empty, the request is rejected.
 *
 * Key properties:
 * - Allows bursts up to the bucket's capacity (maxRequests tokens at once).
 * - Unlike Leaky Bucket, requests are served immediately as long as tokens exist.
 * - Tokens refill gradually — not all at once at the end of the window.
 *
 * Example:
 *   maxRequests     = 10        (bucket capacity)
 *   windowInSeconds = 60
 *   refillRate      = 60 / 10 = 1 token every 6 seconds
 */
export class TokenBucketRateLimiter extends RateLimiter {
    private readonly tokens = new Map<string, number>();
    private readonly lastRefillTime = new Map<string, number>();

    constructor(config: RateLimitConfig) {
        super(config, RateLimitType.TOKEN_BUCKET);
    }

    allowRequest(userId: string): boolean {
        const now = Date.now();

        const currentTokens = this.refillTokens(userId, now);

        if (currentTokens > 0) {
            this.tokens.set(userId, currentTokens - 1);
            return true;
        }

        this.tokens.set(userId, currentTokens);
        return false;
    }

    /**
     * Example:
     * maxRequests = 10
     * windowInSeconds = 60
     * refillRate = 60 / 10 = 6 seconds per token
     */
    private refillTokens(userId: string, now: number): number {
        const refillRate =
            this.config.windowInSeconds / this.config.maxRequests;

        if (!this.lastRefillTime.has(userId)) {
            this.lastRefillTime.set(userId, now);
        }

        const lastRefill = this.lastRefillTime.get(userId)!;
        const elapsedSeconds = (now - lastRefill) / 1000;

        const refillTokens = Math.floor(
            elapsedSeconds / refillRate
        );

        const currentTokens =
            this.tokens.get(userId) ?? this.config.maxRequests;

        const updatedTokens = Math.min(
            this.config.maxRequests,
            currentTokens + refillTokens
        );

        if (refillTokens > 0) {
            this.lastRefillTime.set(userId, now);
        }

        return updatedTokens;
    }
}