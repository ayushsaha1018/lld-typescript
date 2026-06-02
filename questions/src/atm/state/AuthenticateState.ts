import { ATMStatus } from "../enums/ATMStatus";
import { Card } from "../model/Card";
import { ATMMachine } from "../service/ATMMachine";
import type { ATMState } from "./ATMState";
import { DispenseCashState } from "./DispenseCashState";
import { IdleState } from "./IdleState";

export class AuthenticatedState implements ATMState {
  constructor(private readonly atmMachine: ATMMachine) {}

  insertCard(card: Card): void {
    console.log("Card already inserted.");
  }

  enterPin(pin: string): void {
    console.log("Already authenticated.");
  }

  selectOption(option: string): void {
    // can add options like deposit, check balance based on option selected.
    console.log("Option selected: Withdrawal.");

    this.atmMachine.setState(new DispenseCashState(this.atmMachine));
  }

  dispenseCash(amount: number): void {
    console.log("Select an option first.");
  }

  ejectCard(): void {
    this.atmMachine.setCurrentCard(undefined);

    console.log("Card ejected.");

    this.atmMachine.setState(new IdleState(this.atmMachine));
  }

  getStatus(): ATMStatus {
    return ATMStatus.AUTHENTICATED;
  }
}
