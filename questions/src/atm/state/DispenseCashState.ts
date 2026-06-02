import { ATMStatus } from "../enums/ATMStatus";
import { Card } from "../model/Card";
import { ATMMachine } from "../service/ATMMachine";
import { CashDispenserChainBuilder } from "../cor/CashDispenserChainBuilder";
import { IdleState } from "./IdleState";
import type { ATMState } from "./ATMState";
import type { CashDispenser } from "../cor/CashDispenser";

export class DispenseCashState implements ATMState {
  private readonly chain: CashDispenser;

  constructor(private readonly atmMachine: ATMMachine) {
    this.chain = CashDispenserChainBuilder.buildChain();
  }

  insertCard(card: Card): void {
    console.log("Transaction in progress. Cannot insert another card.");
  }

  enterPin(pin: string): void {
    console.log("Already authenticated.");
  }

  selectOption(option: string): void {
    console.log("Option already selected.");
  }

  dispenseCash(amount: number): void {
    const atm = this.atmMachine.getATM();
    const currentCard = this.atmMachine.getCurrentCard();

    if (!currentCard) {
      console.log("No card found.");
      this.ejectCard();
      return;
    }

    const atmBalance = atm.cashAvailable;
    const account = currentCard.getAccount();
    const accountBalance = account.getBalance();

    if (amount > atmBalance) {
      console.log(`ATM has insufficient cash. Cannot dispense ${amount}`);

      this.ejectCard();
      return;
    }

    if (amount > accountBalance) {
      console.log("Insufficient account balance.");

      this.ejectCard();
      return;
    }

    // Check if note combination is possible
    if (this.chain.canDispense(atm, amount)) {
      this.chain.dispense(atm, amount);

      // Deduct from ATM cash & account balance
      atm.cashAvailable = atmBalance - amount;
      account.setBalance(accountBalance - amount);

      console.log(`Cash dispensed: ${amount}`);

      this.ejectCard();
    } else {
      console.log(
        "Cannot dispense requested amount with available denominations.",
      );

      this.ejectCard();
    }
  }

  ejectCard(): void {
    this.atmMachine.setCurrentCard(undefined);

    console.log("Card ejected.");

    this.atmMachine.setState(new IdleState(this.atmMachine));
  }

  getStatus(): ATMStatus {
    return ATMStatus.DISPENSE_CASH;
  }
}
