import { SplitType } from "../enums/SplitType";
import { Split } from "./Split";
import { User } from "./User";

export class Expense {
    constructor(
        public readonly description: string,
        public readonly amount: number,
        public readonly paidBy: User,
        public readonly splits: Split[],
        public readonly splitType: SplitType
    ) {}

    toString(): string {
        return `Expense(description=${this.description}, amount=${this.amount}, paidBy=${this.paidBy.toString()}, splits=[${this.splits.map(s => s.toString()).join(", ")}], splitType=${this.splitType})`;
    }
}
