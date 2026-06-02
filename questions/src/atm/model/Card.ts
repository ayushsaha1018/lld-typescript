import type { Account } from "./Account";

export class Card {
  constructor(
    public readonly cardNumber: string,
    public readonly pin: string,
    public readonly account: Account,
  ) {}

  getAccount(): Account {
    return this.account;
  }
}
