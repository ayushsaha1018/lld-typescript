# ATM Machine — LLD Deep Dive (Interview Edition)

## 🗂️ High-Level Architecture at a Glance

```
index.ts  (entry / wiring)
│
├── model/          ← Pure data (ATM, Account, Card)
├── enums/          ← ATMStatus enum
├── repository/     ← In-memory "database" for ATMs
├── service/        ← ATMMachine — the context/coordinator
├── factory/        ← ATMStateFactory — maps status → state object
├── state/          ← State pattern: Idle, CardInserted, Authenticated, DispenseCash
└── cor/            ← Chain of Responsibility: note dispensers (₹2000, ₹500, ₹100)
```

Two design patterns drive everything:

| Pattern | Where | Why |
|---|---|---|
| **State** | `state/` + `ATMMachine` | ATM behaviour changes completely depending on which stage you're in |
| **Chain of Responsibility (CoR)** | `cor/` | Each denomination tries to handle as much of the amount as possible, then passes the remainder down |

---

## 🧱 Layer 1 — The Models (Pure Data)

### [`Account.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/model/Account.ts)

```ts
export class Account {
  private _balance: number;
  constructor(public readonly accountNumber: string, public readonly balance: number) {
    this._balance = balance;
  }
  getBalance(): number { return this.balance; }      // ← BUG: reads readonly field, not _balance
  setBalance(balance: number): void { this._balance = balance; }
}
```

**What it represents**: A bank account linked to a card. Holds `accountNumber` and `balance`.

---

### [`Card.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/model/Card.ts)

```ts
export class Card {
  constructor(
    public readonly cardNumber: string,
    public readonly pin: string,          // ← Design smell
    public readonly account: Account,
  ) {}
  getAccount(): Account { return this.account; }
}
```

**What it represents**: The physical debit/credit card. It holds its own PIN and a reference to the account.

> [!WARNING]
> **Design Smell — PIN stored in plaintext on Card**: In a real system, you'd never store the PIN directly on the card object. The PIN would be hashed and verified against a secure auth service. In an interview, proactively say: *"For this LLD I'm simplifying, but in production the PIN would be hashed (e.g., bcrypt) and authenticated via a separate AuthService."*

---

### [`ATM.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/model/ATM.ts)

```ts
export class ATM {
  public readonly id: string;
  private _status: ATMStatus;
  private _cashAvailable: number;
  private _twoThousandCount: number;
  private _fiveHundredCount: number;
  private _oneHundredCount: number;
  
  constructor(id, twoThousandCount, fiveHundredCount, oneHundredCount) {
    this._cashAvailable = 2000 * twoThousandCount + 500 * fiveHundredCount + 100 * oneHundredCount;
    this._status = ATMStatus.IDLE;
  }
}
```

**What it represents**: The physical ATM machine's data snapshot. Tracks:
- How many notes of each denomination it has
- Total cash available (pre-computed in constructor)
- Current status (maps to which State it's in)

**Why denomination counts matter**: The CoR dispensers use `atm.twoThousandCount`, etc., to know how many notes are physically available. Just tracking `cashAvailable` alone isn't enough.

> [!NOTE]
> `cashAvailable` is redundant with `twoThousandCount * 2000 + ...`. The code updates them **separately** (see `DispenseCashState`), which means they can drift out of sync if a bug is introduced. A cleaner design would compute `cashAvailable` as a getter derived from the note counts.

---

## 🗄️ Layer 2 — The Repository

### [`ATMRepository.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/repository/ATMRepository.ts)

```ts
export class ATMRepository {
  private atms: Map<string, ATM> = new Map();
  save(atm: ATM): void { ... }
  getById(id: string): ATM | undefined { ... }
  updateATMStatusById(id: string, newStatus: ATMStatus): void { ... }
}
```

**Why this layer exists**: Separates _where_ data is stored from _how_ it's used. Right now it's an in-memory Map, but you could swap it for a database call without changing any other layer. This is the **Repository Pattern**.

> [!NOTE]
> `updateATMStatusById()` is defined but **never called** anywhere in the codebase. Status updates happen directly via `atm.status = state.getStatus()` inside `ATMMachine.setState()`. The method is dead code but represents a good intent — in a real system, you'd want DB persistence on every state change.

---

## ⚙️ Layer 3 — The Service (The Context)

### [`ATMMachine.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/service/ATMMachine.ts)

This is the **heart** of the State Pattern. It acts as the **Context**.

```ts
export class ATMMachine {
  private readonly atm: ATM;           // the data model
  private state: ATMState;             // current state object (changes dynamically)
  private currentCard?: Card;          // card currently in the machine

  constructor(atmId: string, atmRepository: ATMRepository) {
    const atm = atmRepository.getById(atmId);
    this.atm = atm;
    this.state = ATMStateFactory.getState(this.atm.status, this); // ← restores state from DB status
  }

  // All public methods just delegate to the current state
  insertCard(card: Card): void { this.state.insertCard(card); }
  enterPin(pin: string): void { this.state.enterPin(pin); }
  selectOption(option: string): void { this.state.selectOption(option); }
  dispenseCash(amount: number): void { this.state.dispenseCash(amount); }
  ejectCard(): void { this.state.ejectCard(); }

  setState(state: ATMState): void {
    this.state = state;
    this.atm.status = state.getStatus();  // keeps data model in sync
    // persist the changes in db  ← comment hints at real system
  }
}
```

**Key insight**: `ATMMachine` doesn't know **what** to do — it just delegates to `this.state`. This is the entire power of the State Pattern. The caller just calls `insertCard()`, `enterPin()`, etc., without knowing or caring what state the machine is in.

**Why `ATMStateFactory` is called in the constructor**: If the ATM service restarts, the ATM's persisted `status` in the DB is `CARD_INSERTED`. The factory reconstructs the correct state object from that enum, so the system resumes correctly.

---

## 🏭 Layer 4 — The Factory

### [`ATMStateFactory.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/factory/ATMStateFactory.ts)

```ts
static getState(status: ATMStatus, machine: ATMMachine): ATMState {
  switch (status) {
    case ATMStatus.IDLE:            return new IdleState(machine);
    case ATMStatus.CARD_INSERTED:   return new CardInsertedState(machine);
    case ATMStatus.AUTHENTICATED:   return new AuthenticatedState(machine);
    case ATMStatus.DISPENSE_CASH:   return new DispenseCashState(machine);
    default: throw new Error(`Unknown ATM status: ${status}`);
  }
}
```

**Why a factory?** Two reasons:
1. **Single place to add new states**: If you add a new `ATMStatus.DEPOSIT`, you add a case here and create the new state class. Nothing else changes.
2. **Decouples `ATMMachine` from concrete state classes**: `ATMMachine` only knows the `ATMState` interface, not the concrete classes.

> [!TIP]
> In an interview, say: *"The factory ensures Open/Closed Principle — open for extension (new state = new case), closed for modification (ATMMachine.ts is untouched)."*

---

## 🔄 Layer 5 — The States (The Core of the Design)

### The Interface: [`ATMState.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/state/ATMState.ts)

```ts
export interface ATMState {
  insertCard(card: Card): void;
  enterPin(pin: string): void;
  selectOption(option: string): void;
  dispenseCash(amount: number): void;
  ejectCard(): void;
  getStatus(): ATMStatus;
}
```

Every state must implement all these operations. Most states will reject invalid operations with a console message.

---

### State Machine Diagram

```
                 insertCard()
  ┌─────────────────────────────────────────────┐
  │                                             ▼
[IDLE] ──insertCard()──► [CARD_INSERTED] ──correctPIN()──► [AUTHENTICATED] ──selectOption()──► [DISPENSE_CASH]
  ▲                             │                    │                                               │
  │                        ejectCard()           ejectCard()                                   dispenseCash()
  │                             │                    │                                               │
  └─────────────────────────────┴────────────────────┴───────────────────────────────────────────────┘
                                                  (all paths end with ejectCard() → IDLE)
```

---

### [`IdleState.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/state/IdleState.ts)

The ATM is waiting. Only `insertCard()` is valid.

```ts
insertCard(card: Card): void {
  this.atmMachine.setCurrentCard(card);
  this.atmMachine.setState(new CardInsertedState(this.atmMachine)); // transition
}
// All other methods: console.log("No card inserted.")
```

**Transition**: `IDLE → CARD_INSERTED`

---

### [`CardInsertedState.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/state/CardInsertedState.ts)

Card is in. Waiting for PIN. Only `enterPin()` and `ejectCard()` are valid.

```ts
enterPin(pin: string): void {
  const currentCard = this.atmMachine.getCurrentCard();
  if (currentCard.pin === pin) {
    this.atmMachine.setState(new AuthenticatedState(this.atmMachine)); // AUTHENTICATED
  } else {
    console.log("Invalid PIN.");  // stays in CardInsertedState
  }
}
ejectCard(): void {
  this.atmMachine.setCurrentCard(undefined);
  this.atmMachine.setState(new IdleState(this.atmMachine));           // back to IDLE
}
```

> [!CAUTION]
> **Bug #2 — No PIN attempt limit**: There's no counter for failed PIN attempts. In a real ATM, the card should be blocked or swallowed after 3 wrong PINs. In an interview, mention this as a gap and say you'd add a `failedAttempts` counter on the state or on the `Card` model.

**Transitions**: `CARD_INSERTED → AUTHENTICATED` (correct PIN) or `CARD_INSERTED → IDLE` (ejectCard)

---

### [`AuthenticateState.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/state/AuthenticateState.ts)

Authenticated. Waiting for the user to choose an operation. Only `selectOption()` and `ejectCard()` are valid.

```ts
selectOption(option: string): void {
  // can add options like deposit, check balance based on option selected.
  console.log("Option selected: Withdrawal.");
  this.atmMachine.setState(new DispenseCashState(this.atmMachine));
}
```

> [!WARNING]
> **Hardcoded to Withdrawal**: The `option` parameter is received but completely ignored. The comment acknowledges this. In an interview, point this out and say you'd use a `switch(option)` or a map of `option → nextState` to route to `DepositState`, `BalanceInquiryState`, etc.

**Transitions**: `AUTHENTICATED → DISPENSE_CASH` (selectOption) or `AUTHENTICATED → IDLE` (ejectCard)

---

### [`DispenseCashState.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/state/DispenseCashState.ts)

The most complex state. Validates the request, delegates dispensing to the CoR chain, deducts balances.

```ts
constructor(private readonly atmMachine: ATMMachine) {
  this.chain = CashDispenserChainBuilder.buildChain(); // builds the CoR chain
}

dispenseCash(amount: number): void {
  // 1. Is there a card?
  if (!currentCard) { this.ejectCard(); return; }

  // 2. Does ATM have enough cash?
  if (amount > atm.cashAvailable) { this.ejectCard(); return; }

  // 3. Does account have enough balance?
  if (amount > accountBalance) { this.ejectCard(); return; }

  // 4. Can the CoR chain actually form this amount with available notes?
  if (this.chain.canDispense(atm, amount)) {
    this.chain.dispense(atm, amount);       // physically dispense
    atm.cashAvailable = atmBalance - amount; // update ATM total
    account.setBalance(accountBalance - amount); // update account
    this.ejectCard();                        // always end with eject
  } else {
    console.log("Cannot dispense with available denominations.");
    this.ejectCard();
  }
}
```

**The two-phase CoR approach** (`canDispense` then `dispense`) is intentional:
- `canDispense` is a **dry run** — check feasibility without side effects
- `dispense` is the **actual execution** with note count deduction

This prevents partial dispensing: if it's not fully dispensable, we don't dispense anything.

**Transition**: `DISPENSE_CASH → IDLE` (always ends with `ejectCard()`)

---

## 🔗 Layer 6 — Chain of Responsibility (Note Dispensers)

### [`CashDispenser.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/cor/CashDispenser.ts) — The Interface

```ts
export interface CashDispenser {
  setNextDispenser(next: CashDispenser): void;
  canDispense(atm: ATM, amount: number): boolean;
  dispense(atm: ATM, amount: number): void;
}
```

### [`CashDispenserChainBuilder.ts`](file:///Users/video/Desktop/LLD/questions/src/atm/cor/CashDispenserChainBuilder.ts) — The Chain Setup

```ts
const d1 = new TwoThousandDispenser();  // head of chain
const d2 = new FiveHundredDispenser();
const d3 = new OneHundredDispenser();

d1.setNextDispenser(d2);   // ₹2000 → ₹500 → ₹100
d2.setNextDispenser(d3);

return d1; // only the head is returned
```

**Chain**: `₹2000 → ₹500 → ₹100`

---

### How Each Dispenser Works (e.g., `TwoThousandDispenser`)

```ts
canDispense(atm: ATM, amount: number): boolean {
  const availableNotes = atm.twoThousandCount;
  const notes = Math.min(Math.floor(amount / 2000), availableNotes); // use as many ₹2000 as possible
  const remainder = amount - notes * 2000;                            // what's left

  return remainder === 0                           // fully handled here?
      || (this.next?.canDispense(atm, remainder) ?? false); // or next can handle remainder?
}

dispense(atm: ATM, amount: number): void {
  const notes = Math.min(Math.floor(amount / 2000), atm.twoThousandCount);
  atm.twoThousandCount = atm.twoThousandCount - notes; // deduct notes
  const remainder = amount - notes * 2000;
  if (notes > 0) console.log(`Dispensed ${notes} x ₹2000 notes`);
  if (remainder > 0) this.next?.dispense(atm, remainder); // pass remainder down
}
```

**Concrete example from `index.ts`**:

ATM2 has: `0 × ₹2000`, `2 × ₹500`, `5 × ₹100`. Total = ₹1500.  
Request: `dispenseCash(1450)`.

```
TwoThousandDispenser.canDispense(atm, 1450):
  → availableNotes = 0, notes = 0, remainder = 1450
  → delegates to FiveHundredDispenser.canDispense(atm, 1450)

FiveHundredDispenser.canDispense(atm, 1450):
  → availableNotes = 2, notes = min(2, 2) = 2, remainder = 1450 - 1000 = 450
  → delegates to OneHundredDispenser.canDispense(atm, 450)

OneHundredDispenser.canDispense(atm, 450):
  → availableNotes = 5, notes = min(4, 5) = 4, remainder = 450 - 400 = 50
  → no next dispenser, returns (50 === 0 || false) = FALSE ❌

Result: canDispense = false → "Cannot dispense requested amount with available denominations."
```

Wait — this actually fails for 1450 with ATM2's notes! That's intentional; the simulation demonstrates the error path. Try 1400 instead: 2×500 + 4×100 = 1400 ✅

---

## 🔌 Extensibility Points — How to Extend This Design

### 1. Add a New ATM State (e.g., `BalanceInquiryState`, `DepositState`)

1. Create `BalanceInquiryState.ts` implementing `ATMState`
2. Add `BALANCE_INQUIRY` to `ATMStatus` enum
3. Add a case in `ATMStateFactory`
4. In `AuthenticatedState.selectOption()`, route the option string to the new state

**Zero changes to `ATMMachine` or any other existing code.** ✅

---

### 2. Add a New Denomination (e.g., ₹50 notes)

1. Add `_fiftyCount` to `ATM.ts`
2. Create `FiftyDispenser.ts` implementing `CashDispenser`
3. In `CashDispenserChainBuilder`, chain it after `OneHundredDispenser`

**Zero changes to any state logic.** ✅

---

### 3. Swap the Storage Backend

Replace `ATMRepository`'s in-memory `Map` with a DB call. No other layer changes.

---

### 4. Add a Real Auth Service

Create a `PinAuthService` interface. Inject it into `CardInsertedState`. The state calls `authService.verify(card, pin)` instead of `currentCard.pin === pin`.

---

## 💬 Interview Talking Points Cheat Sheet

> **"What design patterns did you use?"**  
> State Pattern for ATM lifecycle management, Chain of Responsibility for denomination dispensing, Factory for state instantiation, Repository for data access abstraction.

> **"Why State Pattern specifically?"**  
> Without it, every method would need a giant `switch(this.status)` block. As states grow, that becomes unmanageable. State Pattern encapsulates each state's behaviour in its own class — SRP and OCP.

> **"How does the cash dispensing work?"**  
> Chain of Responsibility — each denomination handler takes as many notes as it can, passes the remainder to the next handler. It's greedy from highest to lowest denomination. We do a dry-run `canDispense` first to avoid partial disbursement.

> **"What would you improve?"**  
> 1. Fix the `Account.getBalance()` bug  
> 2. Add PIN attempt limit (block/swallow card after 3 failures)  
> 3. Make `selectOption()` actually route based on the option string  
> 4. Make `cashAvailable` a computed getter  
> 5. Use proper PIN hashing instead of plaintext comparison  
> 6. Add concurrency control (two customers can't hit same ATM simultaneously in a distributed system)

> **"How would you handle concurrency?"**  
> In a real system, ATM state transitions would be protected by a distributed lock (e.g., Redis-based) or a DB-level transaction with optimistic locking. The `ATMStatus` in the DB acts as the source of truth.

> **"Is this design extensible?"**  
> Yes — adding a new operation (deposit, balance inquiry) only requires: a new State class + an enum value + one Factory case + one routing line in `AuthenticatedState`. Existing code is untouched. This is the Open/Closed Principle in action.
