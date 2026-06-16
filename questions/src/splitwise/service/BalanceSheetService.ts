import { Group } from "../model/Group";
import { Split } from "../model/Split";
import { User } from "../model/User";

export class BalanceSheetService {
    updateBalances(group: Group, paidBy: User, splits: Split[]): void {
        const totalAmount = splits.reduce((sum, split) => sum + split.amount, 0);
        
        const paidBySheet = group.getBalanceSheet(paidBy);
        if (paidBySheet) {
            paidBySheet.addTotalPaid(totalAmount);
        }

        for (const split of splits) {
            const user = split.user;
            const amt = split.amount;
            
            const userSheet = group.getBalanceSheet(user);
            if (userSheet) {
                userSheet.addTotalExpense(amt);
                
                if (user !== paidBy) {
                    userSheet.addBalance(paidBy, -amt);
                    if (paidBySheet) {
                        paidBySheet.addBalance(user, amt);
                    }
                }
            }
        }
    }
}
