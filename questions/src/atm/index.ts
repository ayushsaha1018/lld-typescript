import { ATM } from "./model/ATM";
import { Account } from "./model/Account";
import { Card } from "./model/Card";
import { ATMRepository } from "./repository/ATMRepository";
import { ATMMachine } from "./service/ATMMachine";

function main(): void {
  const card = new Card("CARD123", "1234", new Account("ACC123", 5000));

  const atm1 = new ATM("ATM1", 5, 5, 20); // 5 * 2000 + 5 * 500 + 20 * 100 = 10000 + 2500 + 2000 = 14500
  const atm2 = new ATM("ATM2", 0, 2, 5); // 0 * 2000 + 2 * 500 + 5 * 100 = 0 + 1000 + 500 = 1500

  const atmRepository = new ATMRepository();

  atmRepository.save(atm1);
  atmRepository.save(atm2);

  const atmMachine2 = new ATMMachine("ATM2", atmRepository);

  atmMachine2.insertCard(card);
  atmMachine2.enterPin("1234");
  atmMachine2.selectOption("WITHDRAW");
  atmMachine2.dispenseCash(1450);
}

main();
