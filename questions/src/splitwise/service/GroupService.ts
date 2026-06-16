import { SplitType } from "../enums/SplitType";
import { User } from "../model/User";
import type { GroupRepository } from "../repository/GroupRepository";
import { DebtSimplificationService } from "./DebtSimplificationService";
import { ExpenseService } from "./ExpenseService";
import { Group } from "../model/Group";

export class GroupService {
    constructor(
        private readonly repo: GroupRepository,
        private readonly expenseService: ExpenseService,
        private readonly simplifier: DebtSimplificationService
    ) { }

    createGroup(name: string, members: User[]): string {
        const id = Math.random().toString(36).substring(2, 15);

        const g = new Group(id, name);
        members.forEach(member => g.addMember(member));

        this.repo.save(g);
        return id;
    }

    addMember(groupId: string, user: User): void {
        this.get(groupId).addMember(user);
    }

    addExpense(
        groupId: string,
        description: string,
        amount: number,
        paidBy: User,
        participants: User[],
        splitType: SplitType,
        meta: Map<User, number> | null
    ): void {
        this.expenseService.addExpense(this.get(groupId), description, amount, paidBy, participants, splitType, meta);
    }

    simplifyDebts(groupId: string): void {
        this.simplifier.simplifyDebts(this.get(groupId));
    }

    printBalances(groupId: string): void {
        const g = this.get(groupId);
        g.getMembers().forEach(u => {
            const sheet = g.getBalanceSheet(u);
            if (!sheet) return;

            let owe = 0;
            let get = 0;

            for (const v of sheet.getBalances().values()) {
                if (v < 0) owe += -v;
                else get += v;
            }

            console.log(`💵 ${u.name}\nPaid: ${sheet.getTotalPaid().toFixed(2)}  Expense: ${sheet.getTotalExpense().toFixed(2)}\nYou owe: ${owe.toFixed(2)}, You get: ${get.toFixed(2)}`);

            sheet.getBalances().forEach((val, other) => {
                const direction = val > 0 ? "← get" : "→ owe";
                console.log(`  ${direction} ${Math.abs(val).toFixed(2)} ${other.name}`);
            });
            console.log("--------------------------");
        });
    }

    private get(id: string): Group {
        const group = this.repo.findById(id);
        if (!group) {
            throw new Error(`Group not found: ${id}`);
        }
        return group;
    }
}
