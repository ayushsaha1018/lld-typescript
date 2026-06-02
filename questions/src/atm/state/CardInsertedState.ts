import { ATMStatus } from "../enums/ATMStatus";
import { Card } from "../model/Card";
import { ATMMachine } from "../service/ATMMachine";
import type { ATMState } from "./ATMState";
import { AuthenticatedState } from "./AuthenticateState";
import { IdleState } from "./IdleState";

export class CardInsertedState implements ATMState {
  constructor(private readonly atmMachine: ATMMachine) {}

  insertCard(card: Card): void {
    console.log("Card already inserted.");
  }

  enterPin(pin: string): void {
    const currentCard = this.atmMachine.getCurrentCard();

    if (!currentCard) {
      console.log("No card inserted.");
      return;
    }

    if (currentCard.pin === pin) {
      console.log("PIN correct. Authenticated.");

      this.atmMachine.setState(new AuthenticatedState(this.atmMachine));
    } else {
      console.log("Invalid PIN.");
    }
  }

  selectOption(option: string): void {
    console.log("Enter PIN first.");
  }

  dispenseCash(amount: number): void {
    console.log("Enter PIN before dispensing.");
  }

  ejectCard(): void {
    this.atmMachine.setCurrentCard(undefined);

    console.log("Card ejected.");

    this.atmMachine.setState(new IdleState(this.atmMachine));
  }

  getStatus(): ATMStatus {
    return ATMStatus.CARD_INSERTED;
  }
}
