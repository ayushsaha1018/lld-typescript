import { User } from "./User";
import { Expense } from "./Expense";
import { BalanceSheet } from "./BalanceSheet";

export class Group {
    private readonly members: User[] = [];
    private readonly expenses: Expense[] = [];
    private readonly balanceSheets: Map<User, BalanceSheet> = new Map();

    constructor(
        public readonly id: string,
        public readonly name: string
    ) {}

    getMembers(): User[] {
        return this.members;
    }

    getExpenses(): Expense[] {
        return this.expenses;
    }

    getBalanceSheets(): Map<User, BalanceSheet> {
        return this.balanceSheets;
    }

    addMember(user: User): void {
        this.members.push(user);
        if (!this.balanceSheets.has(user)) {
            this.balanceSheets.set(user, new BalanceSheet());
        }
    }

    addExpense(expense: Expense): void {
        this.expenses.push(expense);
    }

    getBalanceSheet(user: User): BalanceSheet | undefined {
        return this.balanceSheets.get(user);
    }
}
