import { SplitType } from "../enums/SplitType";
import type { SplitStrategy } from "../strategy/SplitStrategy";
import { EqualSplitStrategy } from "../strategy/EqualSplitStrategy";
import { PercentageSplitStrategy } from "../strategy/PercentageSplitStrategy";

export class SplitStrategyFactory {
    static getStrategy(splitType: SplitType): SplitStrategy {
        switch (splitType) {
            case SplitType.EQUAL:
                return new EqualSplitStrategy();
            case SplitType.PERCENTAGE:
                return new PercentageSplitStrategy();
            default:
                throw new Error("Unknown SplitType: " + splitType);
        }
    }
}
