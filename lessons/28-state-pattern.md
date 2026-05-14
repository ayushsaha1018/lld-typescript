# 28 — State Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Medium — easy to confuse with Strategy, gold for workflow problems

---

## 1. Concept / Theory

**State** lets an object change its behavior when its **internal state** changes. The object appears to change its class. Internally, the object (called the **Context**) delegates state-specific behavior to a separate **State** object, and switches which State object it points to as events occur.

The pattern shows up wherever you find a workflow with **stages**:

* **ATM** — Idle → CardInserted → PinEntered → Authenticated → Dispensing → Idle
* **Vending machine** — NoCoin → HasCoin → Dispensing → SoldOut
* **Order** — Pending → Paid → Shipped → Delivered → Returned
* **Document approval** — Draft → Submitted → UnderReview → Approved/Rejected
* **TCP connection** — Closed → Listening → SynSent → Established → FinWait → Closed
* **Game character** — Idle → Walking → Running → Jumping → Falling → Attacking
* **Promise** — Pending → Fulfilled / Rejected (one-way transitions)

If your domain has explicit *stages* with rules about which transitions are allowed, you have a state machine, and State is the clean way to model it.

```
                     ┌──────────────────┐
                     │     Context      │
                     │  state: State    │ ── delegates ───▶
                     │  + handle()      │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │      State       │  (interface)
                     │ + insertCoin()   │
                     │ + selectItem()   │
                     │ + dispense()     │
                     └────────┬─────────┘
                              △
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  NoCoinState │       │ HasCoinState │       │ DispensingS. │
└──────────────┘       └──────────────┘       └──────────────┘
```

Each State implements the same interface but behaves differently. The Context forwards calls to its current State; the State decides what to do *and* whether to transition the Context to a different State.

### The defining win — replacing nested `if`/`switch`

Without State, a state machine looks like this:

```ts
insertCoin() {
  if (this.state === "noCoin") { /* accept */ this.state = "hasCoin"; }
  else if (this.state === "hasCoin") { /* reject — already have one */ }
  else if (this.state === "dispensing") { /* reject — busy */ }
  else if (this.state === "soldOut") { /* refund */ }
}
selectItem() { /* same switch */ }
dispense()    { /* same switch */ }
```

Every method has the same `switch` over `this.state`. Adding a new state means editing every method. With State, each state is one class implementing all the behaviors for that stage — no switching, just polymorphism.

### The Strategy vs State distinction (interview-critical)

Strategy and State look mechanically identical (Context with a swappable inner object). The difference is **who decides** and **why**:

| Aspect              | Strategy                              | State                                   |
| ------------------- | ------------------------------------- | --------------------------------------- |
| Who chooses?        | Client, externally                    | Object self-transitions                 |
| When does it change?| Usually once, at construction         | During the object's lifecycle           |
| Do options know about each other? | No — independent           | Yes — states know about other states or trigger transitions |
| Why does it change? | Different algorithm per use case       | Different stage of a workflow            |
| Mental model        | "Pluggable algorithm"                  | "Lifecycle stage"                        |

Concrete examples for the same domain:

* `Order.paymentMethod` (Card / UPI / PayPal) → **Strategy**. Picked once, doesn't transition.
* `Order.lifecycleStage` (Pending → Paid → Shipped → Delivered) → **State**. Transitions over the order's life.

Both can coexist on the same object: an Order has a Strategy (payment method) *and* a State (lifecycle stage).

### State explosion — the trap

If your machine has 20 states and 15 events, that's 300 transition entries. State pattern doesn't *eliminate* this; it organizes it. Mitigations:

* **Hierarchical states** — group related states (`Active` parent, with `Walking`, `Running` children).
* **State machine libraries** — XState gives you visualization, persistence, charts, type-safe transitions for non-trivial machines.
* **Ask whether you really have 20 states** — sometimes "20 states" is "5 states × 4 modes," better modeled as State + Strategy or State + flags.

---

## 2. Real-life Analogy

A **traffic light**. It has three states: Red, Yellow, Green. Each state has rules:

* Red allows pedestrians, blocks cars; transitions to Green after 30s.
* Green allows cars, blocks pedestrians; transitions to Yellow after 25s.
* Yellow warns; transitions to Red after 5s.

The light's "behavior" (allow / block / wait time) changes based on its current state. The states themselves drive the transitions — Red doesn't care about Yellow's timer.

Other clean analogies:

* **A microwave.** Stopped → Running → Paused → Stopped → Done. Pressing the same button (`+30s`) does different things depending on the state.
* **A document in Google Docs with a review workflow.** Draft → Submitted → InReview → Approved/Rejected. Comments are allowed in some states, edits in others.
* **A musician playing live.** Setup → Soundcheck → Performing → Encore → Done. You can't "Encore" from "Setup."

---

## 3. Bad Code Example — Switch-on-State Everywhere

Modeling a vending machine without State pattern. This is the canonical interview anti-pattern.

```ts
// ❌ BAD: state stored as a string, every method switches on it
type StateName = "noCoin" | "hasCoin" | "dispensing" | "soldOut";

class VendingMachine {
  private state: StateName = "noCoin";
  private inventory = 5;

  insertCoin() {
    if (this.state === "noCoin") {
      console.log("coin accepted");
      this.state = "hasCoin";
    } else if (this.state === "hasCoin") {
      console.log("already has coin");
    } else if (this.state === "dispensing") {
      console.log("busy, try again");
    } else if (this.state === "soldOut") {
      console.log("sold out, returning coin");
    }
  }

  selectItem() {
    if (this.state === "noCoin") { console.log("insert coin first"); }
    else if (this.state === "hasCoin") {
      console.log("dispensing...");
      this.state = "dispensing";
      this.dispense();
    }
    else if (this.state === "dispensing") { console.log("already dispensing"); }
    else if (this.state === "soldOut")    { console.log("sold out"); }
  }

  dispense() {
    if (this.state !== "dispensing") return;
    this.inventory--;
    if (this.inventory === 0) {
      console.log("here's your item — and we're sold out now");
      this.state = "soldOut";
    } else {
      console.log("here's your item");
      this.state = "noCoin";
    }
  }

  refill(n: number) {
    if (this.state === "soldOut") {
      this.inventory = n;
      this.state = "noCoin";
    }
  }
}
```

What's wrong:

1. **Same switch repeated in every method.** Adding `MaintenanceMode` means editing every method in the class.
2. **Transitions and behavior are entangled.** `insertCoin()` owns "what does insertCoin mean in each state?" *and* "which state should we go to next?" — two responsibilities per method per state. SRP-violating squared.
3. **Easy to forget cases.** `selectItem` doesn't handle `soldOut` cleanly above (handled by accident due to the order of checks, but it's brittle). Compiler can't help.
4. **Invariants leak.** Anyone can flip `this.state = "dispensing"` from outside if it's not strictly private. Invalid transitions are not prevented at compile time.
5. **Testing is messy.** Each test sets up a `state` value and calls a method, mixing setup with assertion.

This is the kind of code that gets written quickly and rotted slowly. State pattern is the structural fix.

---

## 4. Good Code Example — State in TypeScript

### 4a. Vending machine (the canonical interview problem)

```ts
// ============================================================
// 1) State interface — every operation a state must answer for
// ============================================================
interface VMState {
  insertCoin(ctx: VendingMachine): void;
  selectItem(ctx: VendingMachine): void;
  refill(ctx: VendingMachine, n: number): void;
}

// ============================================================
// 2) The Context — holds the current state, exposes operations
// ============================================================
class VendingMachine {
  private state: VMState = new NoCoinState();
  inventory = 5;   // exposed to states for simplicity; could be private with getters

  setState(s: VMState) { this.state = s; }

  insertCoin() { this.state.insertCoin(this); }
  selectItem() { this.state.selectItem(this); }
  refill(n: number) { this.state.refill(this, n); }
}

// ============================================================
// 3) Concrete states — each implements the full interface
// ============================================================
class NoCoinState implements VMState {
  insertCoin(ctx: VendingMachine) {
    console.log("coin accepted");
    ctx.setState(new HasCoinState());
  }
  selectItem(_: VendingMachine) {
    console.log("insert coin first");
  }
  refill(ctx: VendingMachine, n: number) {
    ctx.inventory = n;
    console.log(`refilled to ${n}`);
  }
}

class HasCoinState implements VMState {
  insertCoin(_: VendingMachine) {
    console.log("already has coin");
  }
  selectItem(ctx: VendingMachine) {
    console.log("dispensing...");
    ctx.setState(new DispensingState());
    ctx.selectItem();   // immediately drive the next step
  }
  refill(_: VendingMachine, _n: number) {
    console.log("can't refill while a coin is inserted");
  }
}

class DispensingState implements VMState {
  insertCoin(_: VendingMachine) { console.log("busy, try again"); }
  selectItem(ctx: VendingMachine) {
    ctx.inventory--;
    if (ctx.inventory === 0) {
      console.log("here's your item — and we're sold out now");
      ctx.setState(new SoldOutState());
    } else {
      console.log("here's your item");
      ctx.setState(new NoCoinState());
    }
  }
  refill(_: VendingMachine, _n: number) { console.log("busy"); }
}

class SoldOutState implements VMState {
  insertCoin(_: VendingMachine) { console.log("sold out, returning coin"); }
  selectItem(_: VendingMachine) { console.log("sold out"); }
  refill(ctx: VendingMachine, n: number) {
    ctx.inventory = n;
    console.log(`refilled to ${n}`);
    ctx.setState(new NoCoinState());
  }
}

// ============================================================
// 4) Using it
// ============================================================
const vm = new VendingMachine();
vm.insertCoin();   // coin accepted
vm.insertCoin();   // already has coin
vm.selectItem();   // dispensing... here's your item
```

What changed from the bad version:

* **No method has a `switch`.** Each method is a one-liner that delegates to the current state.
* **Each state knows its own behavior** for every operation — and decides where to transition next.
* **Adding `MaintenanceState`** is a new class. None of the existing states change. None of the Context methods change.
* **Invariants are clearer.** The states themselves are the only things that can call `setState`. Hide it behind a package-private accessor in larger codebases.

### 4b. Type-safe state transitions

For mission-critical state machines, encode allowed transitions in the type system. Three approaches:

**Discriminated unions for state values:**

```ts
type OrderState =
  | { kind: "pending"; placedAt: Date }
  | { kind: "paid"; placedAt: Date; paidAt: Date; txRef: string }
  | { kind: "shipped"; placedAt: Date; paidAt: Date; trackingId: string }
  | { kind: "delivered"; placedAt: Date; paidAt: Date; deliveredAt: Date }
  | { kind: "cancelled"; placedAt: Date; cancelledAt: Date; reason: string };

class Order {
  state: OrderState = { kind: "pending", placedAt: new Date() };

  pay(txRef: string) {
    if (this.state.kind !== "pending") throw new Error("can only pay pending orders");
    this.state = { kind: "paid", placedAt: this.state.placedAt, paidAt: new Date(), txRef };
  }

  ship(trackingId: string) {
    if (this.state.kind !== "paid") throw new Error("can only ship paid orders");
    this.state = {
      kind: "shipped",
      placedAt: this.state.placedAt,
      paidAt: this.state.paidAt,
      trackingId,
    };
  }
}
```

This isn't strictly the GoF State pattern (no per-state class), but it's the modern TS idiom and gives you compile-time guarantees about which fields exist in which state.

**Combine the two:** discriminated-union *data* with State-class *behavior* — for genuinely complex state machines.

### 4c. State + Strategy on the same object

Showing that the two patterns are independent and compose freely:

```ts
class Order {
  // STRATEGY — the payment method, chosen once at checkout
  constructor(private payment: PaymentStrategy) {}

  // STATE — the lifecycle, transitions over time
  private lifecycle: OrderLifecycleState = new PendingState();

  pay(amount: number) {
    return this.lifecycle.pay(this, this.payment, amount);
  }

  ship(trackingId: string) {
    return this.lifecycle.ship(this, trackingId);
  }
}
```

`payment` is a Strategy: chosen externally, swappable per order. `lifecycle` is a State: changes itself based on what happens to the order. Both patterns coexist cleanly because they answer different questions.

### 4d. Production-grade: state machine libraries

For non-trivial machines (10+ states, hierarchies, parallel regions, history), reach for a library like **XState**:

```ts
import { createMachine, interpret } from "xstate";

const orderMachine = createMachine({
  id: "order",
  initial: "pending",
  states: {
    pending:    { on: { PAY:    "paid",    CANCEL: "cancelled" } },
    paid:       { on: { SHIP:   "shipped", REFUND: "refunded"  } },
    shipped:    { on: { DELIVER:"delivered" } },
    delivered:  { type: "final" },
    cancelled:  { type: "final" },
    refunded:   { type: "final" },
  },
});

const order = interpret(orderMachine).start();
order.send({ type: "PAY" });
order.send({ type: "SHIP" });
console.log(order.getSnapshot().value);   // "shipped"
```

Worth mentioning in interviews if the machine gets non-trivial. Interviewers love seeing that you know when to reach for tooling vs hand-rolling.

---

## 5. Real-world Use Cases

* **TCP connection lifecycle** — the OS-level finite state machine: CLOSED → LISTEN → SYN_SENT → ESTABLISHED → FIN_WAIT_1 → ... → CLOSED. Pure State.
* **HTTP/WebSocket lifecycle** — CONNECTING → OPEN → CLOSING → CLOSED in browsers' WebSocket API.
* **Order lifecycle** in any e-commerce platform. The single most-asked LLD interview state machine.
* **Document approval workflows** — Draft → Submitted → UnderReview → Approved/Rejected. Confluence, Notion, JIRA all use this.
* **Game character states** — Idle, Walking, Running, Jumping, Falling, Attacking, Dead. The animation system queries the state to pick the right sprite/animation.
* **Form wizards / multi-step checkout** — Cart → Address → Payment → Review → Confirmation. Each step is a state.
* **Promise** — Pending → Fulfilled or Pending → Rejected. Once resolved, terminal.
* **React legacy lifecycle methods** — Mounting, Updating, Unmounting were essentially state-machine phases. The newer functional components use `useEffect` but the model is similar.
* **XState, Robot, statelyai** — TypeScript libraries built specifically around the State pattern.
* **Workflow engines** — Temporal, AWS Step Functions, Airflow. State machines at scale.
* **CI/CD pipelines** — Queued → Running → Passed/Failed → Reported.
* **Bug tracker statuses** — Open → InProgress → Review → Closed/Reopened.
* **Subscription billing** — Trialing → Active → PastDue → Cancelled / Suspended → Active again.
* **Authentication flow** — Anonymous → AuthRequested → CodeSent → Verified → LoggedIn → LoggedOut.
* **Vending machines, ATMs, elevators** — the textbook LLD interview problems are all state machines.
* **Redux Toolkit's `status`** field convention — `"idle" | "loading" | "succeeded" | "failed"` — encodes a State per slice; reducers act as transitions.

If a system has explicit "stages" or "phases," it's almost certainly best modeled as a state machine.

---

## 6. Interview Questions

### Q1. State vs Strategy — what's the difference?

**Answer:** They look identical structurally — a Context holds a varying object — but their *intent* differs.

* **Strategy** — the *client* chooses the algorithm, externally. Different strategies are independent; they don't know about each other. The Context's behavior changes because someone *plugged in* a different strategy.
* **State** — the *object self-transitions* between states based on internal events. States know about other states (or call `ctx.setState(NewState)` to trigger transitions). The Context's behavior changes because *something happened* internally.

A useful test: search for `setState` or `transitionTo` calls *inside* the variant classes themselves. If they're there, it's State. If swapping happens entirely from outside, it's Strategy.

Concrete: `Order.paymentMethod` (Card / UPI) → Strategy. `Order.lifecycleStage` (Pending → Paid → Shipped) → State. They can coexist on the same object — they answer different questions.

---

### Q2. Walk me through implementing a Vending Machine using the State pattern.

**Answer:** (See section 4a for the full code; here's the walkthrough.)

I'd start by listing the **states** and **events**:

* States: `NoCoin`, `HasCoin`, `Dispensing`, `SoldOut`.
* Events: `insertCoin`, `selectItem`, `refill(n)`.

Each state must answer all events — that's the contract. I'd draw the transition table:

| State / Event | insertCoin | selectItem | refill |
|---------------|------------|------------|--------|
| NoCoin        | → HasCoin  | reject     | (no transition) |
| HasCoin       | reject     | → Dispensing → NoCoin (or SoldOut) | reject |
| Dispensing    | reject     | (proceeds) | reject |
| SoldOut       | refund     | reject     | → NoCoin |

Then I'd implement: a `VMState` interface with the three event methods, four classes (one per state), and a `VendingMachine` Context that delegates to the current state.

Things the interviewer wants to hear:

1. **Each state class implements every event.** No partial states.
2. **Transitions are encapsulated within states**, not in the Context.
3. **Context is thin** — just delegates to the current state and exposes a `setState`.
4. **Adding a new state** (e.g. `MaintenanceMode`) is one new class. No existing state or method changes.
5. **Edge cases**: insertCoin in Dispensing returns the coin? double-coin handling? coin denominations? Mention you'd discuss these with the interviewer.

Senior signal: "For a real production vending machine I'd reach for XState — type-safe transitions, visualization, ability to persist and resume mid-state. Hand-rolling is fine for the interview but the trade-off is real."

---

### Q3. When should I use the State pattern vs just an enum + switch?

**Answer:** Reach for State pattern when **any** of these are true:

1. You have **3+ states** and **3+ operations**, where each operation behaves differently per state. The number of switch cases blooms quickly.
2. **Transitions are non-trivial** — there are rules about which transitions are allowed (e.g., can't ship a Pending order). Centralizing transitions in state classes keeps the rules in one place.
3. **State-specific data exists** — a `Shipped` order has a `trackingId`, a `Cancelled` order has a `reason`. State pattern + discriminated unions express this naturally; raw enums force you to add nullable fields.
4. **States have entry/exit behavior** — "on entering Dispensing, log; on leaving, decrement inventory." State classes give you the natural place to put this.
5. **You need polymorphic dispatch** — code outside the state machine wants to call `state.canEdit()` or `state.allowedTransitions()` without switching.

Stick with **enum + switch** when:

* The state machine is tiny (2-3 states, 1-2 operations).
* Transitions are trivial (no rules to enforce).
* No state-specific data.
* The whole thing fits readably on one screen.

State pattern adds files; sometimes a flat enum + switch is genuinely simpler. Don't add ceremony for ceremony's sake.

---

### Q4. How does the State pattern relate to OCP and SRP?

**Answer:** It's an excellent embodiment of both.

* **Open/Closed (O):** Adding a new state is *adding* one class — no existing state changes, no Context method changes. The system is open for new states, closed against modification of existing ones.
* **Single Responsibility (S):** Each state class has one job — define behavior for one phase of the workflow. Without State, the Context's methods carry every state's behavior, mixing N responsibilities into one method.

State also nudges you toward the **Liskov Substitution** principle: every concrete state must implement every interface method, so callers can hold any `State` reference and call any operation without checking which concrete state is underneath.

The trade-off: State *increases* the class count. You go from one class with five methods to one Context + N state classes. For large machines this scales naturally; for tiny ones it can feel ceremonious. Use judgment.

---

### Q5. What's the "state explosion" problem and how do you mitigate it?

**Answer:** State explosion happens when the number of states and the number of orthogonal modes interact multiplicatively. A character that can be (Walking | Running | Idle) AND (Armed | Unarmed) AND (Healthy | Wounded) is technically 12 states, but writing 12 state classes is silly because most behavior is shared.

Mitigations:

1. **Hierarchical state machines** — group states under parents. `Active` parent has substates `Walking`, `Running`, `Idle`. Shared behavior lives on the parent; substates override only what differs. XState supports this directly.
2. **Orthogonal regions / parallel states** — model the dimensions independently. The character has *two* parallel state machines: movement and weapon. Cross-product is implicit.
3. **State + flags** — for binary modes that don't change full behavior, a flag is fine. `state.armed: boolean` rather than `ArmedWalkingState`, `UnarmedWalkingState`, ...
4. **State + Strategy** — if one dimension is "pluggable algorithm" rather than "lifecycle stage," model that dimension as Strategy. Walking algorithm changes between Healthy and Wounded? Maybe Wounded changes the Strategy, not the State.
5. **Reach for tooling** — XState's visualizer makes hierarchical and parallel machines tractable. For 20+ state systems, hand-rolling becomes a liability.

The senior framing: "If I'm seeing 20 state classes, I ask whether I really have 20 lifecycle stages or whether I'm encoding orthogonal dimensions. The latter usually decomposes into a smaller machine + flags or parallel regions."

---

## TL;DR Cheat Sheet

```
State: let an object change behavior when its internal state changes
       by delegating to a State object that itself can trigger transitions.

Recipe:
  1. State interface — methods for every operation
  2. Concrete State classes — one per stage of the workflow
  3. Context — holds current State, delegates calls, exposes setState()
  4. States call ctx.setState(NewState) to transition

Use when:
  - workflow has explicit stages (lifecycle, approval, machine modes)
  - transition rules matter (some transitions are illegal)
  - methods would otherwise switch on a state field everywhere
  - state-specific data exists (each stage has its own fields)

Don't use when:
  - 2-3 states with trivial transitions — enum + switch is simpler
  - "states" are really orthogonal modes — use flags or parallel regions

vs Strategy: SAME shape, DIFFERENT intent.
  - Strategy: client picks externally, no transitions, options independent.
  - State:    object self-transitions internally, states know each other.
  - Test: is there a setState() call inside the variant classes? → State.

Type-safe TS form: discriminated union per state.
  type OrderState =
    | { kind: "pending"; placedAt: Date }
    | { kind: "paid"; placedAt: Date; txRef: string }
    | ...

Common pitfalls:
  - State explosion (use hierarchical states / parallel regions / XState)
  - Forgetting to handle every event in every state (ISP via interface helps)
  - Letting the Context flip its own state directly (defeats encapsulation)

Combines well with:
  - Strategy (different concerns; can coexist on same object)
  - Memento (snapshot/restore state)
  - Observer (notify on transitions)

Real-world: TCP/WebSocket, Promise, Order lifecycle, ATM, vending machine,
            game character states, document approval, form wizards,
            CI/CD pipeline status, subscription billing, XState library.
```
