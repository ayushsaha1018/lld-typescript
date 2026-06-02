import { ATM } from "../model/ATM";
import { ATMStatus } from "../enums/ATMStatus";

export class ATMRepository {
  private atms: Map<string, ATM> = new Map();

  save(atm: ATM): void {
    this.atms.set(atm.id, atm);
  }

  getById(id: string): ATM | undefined {
    return this.atms.get(id);
  }

  updateATMStatusById(id: string, newStatus: ATMStatus): void {
    const atm = this.atms.get(id);

    if (!atm) {
      throw new Error(`ATM with id ${id} not found`);
    }

    atm.status = newStatus;
  }
}
