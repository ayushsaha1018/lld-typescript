import { ATMStatus } from "../enums/ATMStatus";
import { Card } from "../model/Card";

export interface ATMState {
  insertCard(card: Card): void;

  enterPin(pin: string): void;

  selectOption(option: string): void;

  dispenseCash(amount: number): void;

  ejectCard(): void;

  getStatus(): ATMStatus;
}
