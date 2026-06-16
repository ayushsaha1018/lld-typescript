import { Split } from "../model/Split";
import { User } from "../model/User";

export interface SplitStrategy {
    split(totalAmount: number, participants: User[], metadata: Map<User, number> | null): Split[];
}
