import { ATMStatus } from "../enums/ATMStatus";
import { Card } from "../model/Card";
import type { ATMMachine } from "../service/ATMMachine";
import type { ATMState } from "./ATMState";
import { CardInsertedState } from "./CardInsertedState";

export class IdleState implements ATMState {
  constructor(private readonly atmMachine: ATMMachine) {}

  insertCard(card: Card): void {
    this.atmMachine.setCurrentCard(card);

    console.log("Card inserted.");

    this.atmMachine.setState(new CardInsertedState(this.atmMachine));
  }

  enterPin(pin: string): void {
    console.log("No card inserted.");
  }

  selectOption(option: string): void {
    console.log("No card inserted.");
  }

  dispenseCash(amount: number): void {
    console.log("No card inserted.");
  }

  ejectCard(): void {
    console.log("No card to eject.");
  }

  getStatus(): ATMStatus {
    return ATMStatus.IDLE;
  }
}
