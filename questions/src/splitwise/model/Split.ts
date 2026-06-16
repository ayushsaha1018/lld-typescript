import { User } from "./User";

export class Split {
    constructor(
        public readonly user: User,
        public amount: number
    ) {}

    toString(): string {
        return `Split(user=${this.user.toString()}, amount=${this.amount})`;
    }
}
