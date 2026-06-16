import { Group } from "../model/Group";
import { User } from "../model/User";
import { PriorityQueue } from "../utils/PriorityQueue";

export class DebtSimplificationService {
    simplifyDebts(group: Group): void {
        const users: User[] = [...group.getMembers()];
        const sheets = group.getBalanceSheets();

        // Step 1: Calculate net balances for each user
        const netBalances: Map<User, number> = new Map();
        for (const user of users) {
            let net = 0.0;
            const sheet = sheets.get(user);
            if (sheet) {
                const balances = sheet.getBalances();
                for (const amount of balances.values()) {
                    net += amount;
                }
                netBalances.set(user, net);
                sheet.clearBalances(); // Clear old balances before recomputing
            }
        }

        // Step 2: Separate creditors and debtors
        // Java: PriorityQueue<User> creditors = new PriorityQueue<>((a, b) -> Double.compare(netBalances.get(b), netBalances.get(a)));
        const creditors = new PriorityQueue<User>((a, b) => (netBalances.get(b) || 0) - (netBalances.get(a) || 0));
        // Java: PriorityQueue<User> debtors = new PriorityQueue<>((a, b) -> Double.compare(netBalances.get(a), netBalances.get(b)));
        const debtors = new PriorityQueue<User>((a, b) => (netBalances.get(a) || 0) - (netBalances.get(b) || 0));

        for (const user of users) {
            const net = netBalances.get(user) || 0;
            if (net > 1e-6) {
                creditors.offer(user);
            } else if (net < -1e-6) {
                debtors.offer(user);
            }
        }

        // Step 3: Match debtors and creditors to settle debts
        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            const creditor = creditors.poll();
            const debtor = debtors.poll();

            if (!creditor || !debtor) break;

            const creditAmount = netBalances.get(creditor) || 0;
            const debitAmount = netBalances.get(debtor) || 0;

            const settledAmount = Math.min(creditAmount, -debitAmount);

            // Update balances both sides
            const creditorSheet = sheets.get(creditor);
            const debtorSheet = sheets.get(debtor);

            if (creditorSheet && debtorSheet) {
                creditorSheet.addBalance(debtor, settledAmount);
                debtorSheet.addBalance(creditor, -settledAmount);
            }

            // Update net balances after settlement
            netBalances.set(creditor, creditAmount - settledAmount);
            netBalances.set(debtor, debitAmount + settledAmount);

            // If still unsettled, re-add to queues
            if ((netBalances.get(creditor) || 0) > 1e-6) {
                creditors.offer(creditor);
            }
            if ((netBalances.get(debtor) || 0) < -1e-6) {
                debtors.offer(debtor);
            }
        }
    }
}
