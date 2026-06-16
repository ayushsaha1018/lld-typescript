import { SplitType } from "../enums/SplitType";
import { SplitStrategyFactory } from "../factory/SplitStrategyFactory";
import { Expense } from "../model/Expense";
import { Group } from "../model/Group";
import { Split } from "../model/Split";
import { User } from "../model/User";
import { BalanceSheetService } from "./BalanceSheetService";

export class ExpenseService {
    constructor(private readonly balanceSheetService: BalanceSheetService) {}

    addExpense(
        group: Group, 
        description: string, 
        amount: number, 
        paidBy: User, 
        participants: User[], 
        splitType: SplitType, 
        metadata: Map<User, number> | null
    ): void {
        const strategy = SplitStrategyFactory.getStrategy(splitType);
        const splits: Split[] = strategy.split(amount, participants, metadata);
        
        const expense = new Expense(description, amount, paidBy, splits, splitType);
        group.addExpense(expense);

        this.balanceSheetService.updateBalances(group, paidBy, splits);
    }
}
