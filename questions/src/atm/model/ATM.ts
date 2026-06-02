import { ATMStatus } from "../enums/ATMStatus";

export class ATM {
  public readonly id: string;

  private _status: ATMStatus;
  private _cashAvailable: number;

  private _twoThousandCount: number;
  private _fiveHundredCount: number;
  private _oneHundredCount: number;

  constructor(
    id: string,
    twoThousandCount: number,
    fiveHundredCount: number,
    oneHundredCount: number,
  ) {
    this.id = id;

    this._twoThousandCount = twoThousandCount;
    this._fiveHundredCount = fiveHundredCount;
    this._oneHundredCount = oneHundredCount;

    this._cashAvailable =
      2000 * twoThousandCount + 500 * fiveHundredCount + 100 * oneHundredCount;

    this._status = ATMStatus.IDLE;
  }

  get status(): ATMStatus {
    return this._status;
  }

  set status(status: ATMStatus) {
    this._status = status;
  }

  get cashAvailable(): number {
    return this._cashAvailable;
  }

  set cashAvailable(cashAvailable: number) {
    this._cashAvailable = cashAvailable;
  }

  get twoThousandCount(): number {
    return this._twoThousandCount;
  }

  set twoThousandCount(count: number) {
    this._twoThousandCount = count;
  }

  get fiveHundredCount(): number {
    return this._fiveHundredCount;
  }

  set fiveHundredCount(count: number) {
    this._fiveHundredCount = count;
  }

  get oneHundredCount(): number {
    return this._oneHundredCount;
  }

  set oneHundredCount(count: number) {
    this._oneHundredCount = count;
  }
}
