import { ATM } from "../model/ATM";
import type { CashDispenser } from "./CashDispenser";

export class TwoThousandDispenser implements CashDispenser {
  private next?: CashDispenser;

  setNextDispenser(next: CashDispenser): void {
    this.next = next;
  }

  canDispense(atm: ATM, amount: number): boolean {
    const availableNotes = atm.twoThousandCount;
    const notes = Math.min(Math.floor(amount / 2000), availableNotes);
    const remainder = amount - notes * 2000;

    return remainder === 0 || (this.next?.canDispense(atm, remainder) ?? false);
  }

  dispense(atm: ATM, amount: number): void {
    const availableNotes = atm.twoThousandCount;
    const notes = Math.min(Math.floor(amount / 2000), availableNotes);

    atm.twoThousandCount = availableNotes - notes;
    const remainder = amount - notes * 2000;

    if (notes > 0) {
      console.log(`Dispensed ${notes} x ₹2000 notes`);
    }

    if (remainder > 0) {
      this.next?.dispense(atm, remainder);
    }
  }
}
