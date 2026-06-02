import { ATM } from "../model/ATM";

export interface CashDispenser {
  setNextDispenser(next: CashDispenser): void;

  canDispense(atm: ATM, amount: number): boolean;

  dispense(atm: ATM, amount: number): void;
}
