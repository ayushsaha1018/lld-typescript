import { Split } from "../model/Split";
import { User } from "../model/User";
import type { SplitStrategy } from "./SplitStrategy";

export class PercentageSplitStrategy implements SplitStrategy {
    split(totalAmount: number, participants: User[], metadata: Map<User, number> | null): Split[] {
        if (!metadata) {
            throw new Error("Metadata is required for percentage split");
        }

        let totalPercent = 0;
        for (const percent of metadata.values()) {
            totalPercent += percent;
        }

        // Using a small epsilon to handle floating point comparisons
        if (Math.abs(totalPercent - 100.0) > 1e-6) {
            throw new Error("Total percent should be 100");
        }

        const splits: Split[] = [];
        for (const user of participants) {
            const percent = metadata.get(user) || 0.0;
            splits.push(new Split(user, totalAmount * (percent / 100.0)));
        }
        return splits;
    }
}
