import { RateLimitType, UserTier } from "../enums";
import { RateLimiterFactory } from "../factory/RateLimiterFactory";
import { RateLimiter } from "../limiter/RateLimiter";
import { RateLimitConfig, User } from "../models";

export class RateLimiterService {
    private readonly rateLimiters = new Map<UserTier, RateLimiter>();

    constructor() {
        // Configure per-tier limits + algorithms

        this.rateLimiters.set(
            UserTier.FREE,
            RateLimiterFactory.createRateLimiter(
                RateLimitType.TOKEN_BUCKET,
                new RateLimitConfig(10, 60) // 10 req/min
            )
        );

        this.rateLimiters.set(
            UserTier.PREMIUM,
            RateLimiterFactory.createRateLimiter(
                RateLimitType.FIXED_WINDOW,
                new RateLimitConfig(100, 60) // 100 req/min
            )
        );
    }

    allowRequest(user: User): boolean {
        const limiter = this.rateLimiters.get(user.tier);

        if (!limiter) {
            throw new Error(
                `No limiter configured for tier: ${user.tier}`
            );
        }

        return limiter.allowRequest(user.userId);
    }
}