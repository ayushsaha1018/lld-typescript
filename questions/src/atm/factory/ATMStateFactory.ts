import { ATMStatus } from "../enums/ATMStatus";
import type { ATMMachine } from "../service/ATMMachine";
import type { ATMState } from "../state/ATMState";
import { AuthenticatedState } from "../state/AuthenticateState";
import { CardInsertedState } from "../state/CardInsertedState";
import { DispenseCashState } from "../state/DispenseCashState";
import { IdleState } from "../state/IdleState";

export class ATMStateFactory {
  static getState(status: ATMStatus, machine: ATMMachine): ATMState {
    switch (status) {
      case ATMStatus.IDLE:
        return new IdleState(machine);

      case ATMStatus.CARD_INSERTED:
        return new CardInsertedState(machine);

      case ATMStatus.AUTHENTICATED:
        return new AuthenticatedState(machine);

      case ATMStatus.DISPENSE_CASH:
        return new DispenseCashState(machine);

      default:
        throw new Error(`Unknown ATM status: ${status}`);
    }
  }
}
