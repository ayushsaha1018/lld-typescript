import { User } from "./User";

export class BalanceSheet {
    private totalPaid: number = 0.0;
    private totalExpense: number = 0.0;
    private readonly balances: Map<User, number> = new Map();

    getTotalPaid(): number {
        return this.totalPaid;
    }

    getTotalExpense(): number {
        return this.totalExpense;
    }

    getBalances(): Map<User, number> {
        return this.balances;
    }

    addTotalPaid(amount: number): void {
        this.totalPaid += amount;
    }

    addTotalExpense(amount: number): void {
        this.totalExpense += amount;
    }

    addBalance(other: User, amount: number): void {
        const currentBalance = this.balances.get(other) || 0.0;
        const newBalance = currentBalance + amount;
        this.balances.set(other, newBalance);
        
        if (Math.abs(newBalance) < 1e-6) {
            this.balances.delete(other);
        }
    }

    clearBalances(): void {
        this.balances.clear();
    }
}
