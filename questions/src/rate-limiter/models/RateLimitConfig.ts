export class RateLimitConfig {
    constructor(
        public readonly maxRequests: number,
        public readonly windowInSeconds: number,
    ) { }
}
