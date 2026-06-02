import { ATM } from "../model/ATM";
import type { CashDispenser } from "./CashDispenser";

export class OneHundredDispenser implements CashDispenser {
  private next?: CashDispenser;

  setNextDispenser(next: CashDispenser): void {
    this.next = next;
  }

  canDispense(atm: ATM, amount: number): boolean {
    const availableNotes = atm.oneHundredCount;
    const notes = Math.min(Math.floor(amount / 100), availableNotes);
    const remainder = amount - notes * 100;

    return remainder === 0 || (this.next?.canDispense(atm, remainder) ?? false);
  }

  dispense(atm: ATM, amount: number): void {
    const availableNotes = atm.oneHundredCount;
    const notes = Math.min(Math.floor(amount / 100), availableNotes);
    const remainder = amount - notes * 100;

    atm.oneHundredCount = availableNotes - notes;

    if (notes > 0) {
      console.log(`Dispensed ${notes} x ₹100 notes`);
    }

    if (remainder > 0) {
      this.next?.dispense(atm, remainder);
    }
  }
}
