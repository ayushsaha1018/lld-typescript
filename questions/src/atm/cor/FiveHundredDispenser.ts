import { ATM } from "../model/ATM";
import type { CashDispenser } from "./CashDispenser";

export class FiveHundredDispenser implements CashDispenser {
  private next?: CashDispenser;

  setNextDispenser(next: CashDispenser): void {
    this.next = next;
  }

  canDispense(atm: ATM, amount: number): boolean {
    const availableNotes = atm.fiveHundredCount;
    const notes = Math.min(Math.floor(amount / 500), availableNotes);
    const remainder = amount - notes * 500;

    return remainder === 0 || (this.next?.canDispense(atm, remainder) ?? false);
  }

  dispense(atm: ATM, amount: number): void {
    const availableNotes = atm.fiveHundredCount;
    const notes = Math.min(Math.floor(amount / 500), availableNotes);
    const remainder = amount - notes * 500;

    atm.fiveHundredCount = availableNotes - notes;

    if (notes > 0) {
      console.log(`Dispensed ${notes} x ₹500 notes`);
    }

    if (remainder > 0) {
      this.next?.dispense(atm, remainder);
    }
  }
}
