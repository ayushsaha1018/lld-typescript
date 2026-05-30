import type { RateLimitType } from "../enums";
import type { RateLimitConfig } from "../models";

export abstract class RateLimiter {
  constructor(
    protected readonly config: RateLimitConfig,
    protected readonly type: RateLimitType,
  ) { }

  abstract allowRequest(userId: string): boolean;
}
