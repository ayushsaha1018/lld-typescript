import { Split } from "../model/Split";
import { User } from "../model/User";
import type { SplitStrategy } from "./SplitStrategy";

export class EqualSplitStrategy implements SplitStrategy {
    split(totalAmount: number, participants: User[], metadata: Map<User, number> | null): Split[] {
        const share = totalAmount / participants.length;
        const splits: Split[] = [];
        for (const user of participants) {
            splits.push(new Split(user, share));
        }
        return splits;
    }
}
