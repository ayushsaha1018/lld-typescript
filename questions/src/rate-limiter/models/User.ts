import type { UserTier } from "../enums";

export class User {
    constructor(
        public readonly userId: string,
        public readonly tier: UserTier,
    ) { }
}

