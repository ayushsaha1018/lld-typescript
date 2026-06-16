import { SplitType } from "./enums/SplitType";
import { User } from "./model/User";
import { InMemoryGroupRepository } from "./repository/InMemoryGroupRepository";
import { BalanceSheetService } from "./service/BalanceSheetService";
import { DebtSimplificationService } from "./service/DebtSimplificationService";
import { ExpenseService } from "./service/ExpenseService";
import { GroupService } from "./service/GroupService";

function main() {
    // users
    const shubh = new User("u1", "Shubh");
    const bob = new User("u2", "Bob");
    const tom = new User("u3", "Tom");
    const jake = new User("u4", "Jake");

    const repo = new InMemoryGroupRepository();
    const balanceSheetService = new BalanceSheetService();
    const expenseService = new ExpenseService(balanceSheetService);
    const simplificationService = new DebtSimplificationService();

    const groupService = new GroupService(repo, expenseService, simplificationService);

    /* ---------- create groups ---------- */
    const goaGroupId = groupService.createGroup("Goa Trip", [shubh, bob, tom]);
    const miscGroup = groupService.createGroup("Non-Group Expenses", [shubh, bob, tom, jake]);

    /* ---------- add expenses ---------- */
    groupService.addExpense(
        goaGroupId,
        "Lunch Day-1",
        100,
        shubh,
        [shubh, bob],
        SplitType.EQUAL,
        null
    );

    groupService.addExpense(
        goaGroupId,
        "Lunch Day-2",
        100,
        bob,
        [bob, tom],
        SplitType.EQUAL,
        null
    );

    /* ---------- simplify & print ---------- */
    groupService.simplifyDebts(goaGroupId);
    groupService.printBalances(goaGroupId);
}

main();
