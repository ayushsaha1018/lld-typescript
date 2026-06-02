import { ATMStateFactory } from "../factory/ATMStateFactory";
import { ATM } from "../model/ATM";
import { Card } from "../model/Card";
import { ATMRepository } from "../repository/ATMRepository";
import type { ATMState } from "../state/ATMState";

export class ATMMachine {
  private readonly atm: ATM;
  private state: ATMState;
  private readonly atmRepository: ATMRepository;

  private currentCard?: Card;

  constructor(atmId: string, atmRepository: ATMRepository) {
    this.atmRepository = atmRepository;

    const atm = atmRepository.getById(atmId);

    if (!atm) {
      throw new Error("ATM not found");
    }

    this.atm = atm;
    this.state = ATMStateFactory.getState(this.atm.status, this);
  }

  insertCard(card: Card): void {
    this.state.insertCard(card);
  }

  enterPin(pin: string): void {
    this.state.enterPin(pin);
  }

  selectOption(option: string): void {
    this.state.selectOption(option);
  }

  dispenseCash(amount: number): void {
    this.state.dispenseCash(amount);
  }

  ejectCard(): void {
    this.state.ejectCard();
  }

  setState(state: ATMState): void {
    this.state = state;

    this.atm.status = state.getStatus();

    // persist the changes in db
  }

  getATM(): ATM {
    return this.atm;
  }

  getState(): ATMState {
    return this.state;
  }

  getATMRepository(): ATMRepository {
    return this.atmRepository;
  }

  getCurrentCard(): Card | undefined {
    return this.currentCard;
  }

  setCurrentCard(card?: Card): void {
    this.currentCard = card;
  }
}
