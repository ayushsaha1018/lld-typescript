export class Account {
  private _balance: number;

  constructor(
    public readonly accountNumber: string,
    initialBalance: number,
  ) {
    this._balance = initialBalance;
  }

  getBalance(): number {
    return this._balance;
  }

  setBalance(balance: number): void {
    this._balance = balance;
  }
}
