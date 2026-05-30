

import { RateLimitType } from "../enums";
import { FixedWindowRateLimiter } from "../limiter/FixedWindowRateLimiter";
import { LeakyBucketRateLimiter } from "../limiter/LeakyBucketRateLimiter";
import { RateLimiter } from "../limiter/RateLimiter";
import { SlidingWindowCounterRateLimiter } from "../limiter/SlidingWindowCounterRateLimiter";
import { SlidingWindowLogRateLimiter } from "../limiter/SlidingWindowLogRateLimiter";
import { TokenBucketRateLimiter } from "../limiter/TokenBucketRateLimiter";
import type { RateLimitConfig } from "../models";

export class RateLimiterFactory {
    static createRateLimiter(
        algo: RateLimitType,
        config: RateLimitConfig
    ): RateLimiter {
        switch (algo) {
            case RateLimitType.TOKEN_BUCKET:
                return new TokenBucketRateLimiter(config);

            case RateLimitType.FIXED_WINDOW:
                return new FixedWindowRateLimiter(config);

            case RateLimitType.SLIDING_WINDOW_LOG:
                return new SlidingWindowLogRateLimiter(config);

            case RateLimitType.SLIDING_WINDOW_COUNTER:
                return new SlidingWindowCounterRateLimiter(config);

            case RateLimitType.LEAKY_BUCKET:
                return new LeakyBucketRateLimiter(config);

            default:
                throw new Error(`Unknown algorithm: ${algo}`);
        }
    }
}