# Lesson 11 — SOLID: O — Open/Closed Principle

> **Phase 2 — OOP & SOLID** · *Lesson 3 of 6*
> "Add new behavior without editing the old code." This is the principle that makes large codebases survive years of change without rotting.

---

## 1. Concept / Theory

### The definition

> *"Software entities (classes, modules, functions) should be **open for extension**, but **closed for modification**."*
> — Bertrand Meyer (1988), refined by Robert C. Martin

Two clauses, opposite-sounding, both true at once:

- **Open for extension** — you can add new behavior to the system.
- **Closed for modification** — without changing the existing, working, tested code that's already in production.

How is that possible? **Polymorphism.** You add new behavior by writing a *new class* that conforms to an existing abstraction, not by editing an existing one.

### The plain-English version

> When a new requirement arrives, you should be able to satisfy it by **writing new code**, not by **editing tested code**.

If your design forces you to crack open `OrderService` every time a new payment method or notification channel arrives, your design isn't OCP-compliant. If you can satisfy the requirement by adding `RazorpayProcessor implements PaymentProcessor` and registering it — without touching anything else — you are.

### Why OCP matters

1. **Tested code stays tested.** Editing existing code re-opens the test surface. Adding a new class only needs new tests.
2. **Smaller blast radius.** A bug in `RazorpayProcessor` can't take down `StripeProcessor`. You don't share a file, you don't share a deploy unit.
3. **Parallel work.** Two engineers can each add a new variant simultaneously without merge conflicts.
4. **Safer rollouts.** Feature-flag the new class on; existing classes unchanged.
5. **Cheaper review.** Reviewers verify the new file is correct, instead of re-validating an entire god class.

### The mechanism — abstraction + polymorphism

OCP isn't a syntax feature; it's a structural choice. The pattern is:

```
abstraction (interface / abstract class)
   ↑                ↑                ↑
ConcreteA      ConcreteB        ConcreteC   ← extensions added here
```

Callers depend on the **abstraction**. New behavior arrives as a new concrete class. The caller doesn't change.

You've already practiced this:
- Lesson 03 — polymorphism is the engine.
- Lesson 04 — Duck/RobotDuck refactor: pluggable behaviors *are* the OCP.
- Lesson 09 — the Notifier example explicitly named OCP.

This lesson formalizes what you've been doing.

### Where OCP is tested in interviews

Almost every LLD design question secretly tests OCP:
- *"Design a payment system."* → can you add a new payment method without touching old code?
- *"Design a notification system."* → can you add WhatsApp later?
- *"Design a parking lot."* → can you add electric/disabled spots without changing the allocator?

If your design forces a giant switch statement that grows every time, you're failing OCP. If your design is "write a new class that implements `X`", you're winning.

### What OCP is *not*

- **Not "never edit code".** You absolutely edit code — to fix bugs, to refactor, to evolve the abstraction itself. OCP is about adding **new behavior**: new types, new variants, new strategies. Bug fixes and abstraction tweaks are different.
- **Not premature abstraction.** You don't pre-emptively make every class extensible. You apply OCP at **predictable extension points** — places where you genuinely expect new variants. (Payment methods? Yes. The slugify helper? No.)

---

## 2. Real-life Analogy

A **power outlet** in your wall is the textbook OCP example.

The outlet is **closed for modification** — once installed, you don't rewire it every time you buy a new appliance. The shape and voltage of the socket is fixed. **It's stable.**

But the outlet is **open for extension** — you can plug in a phone charger today, a vacuum tomorrow, a laptop, a kettle, a 3D printer. Each new appliance is a *new device that conforms to the existing socket interface*. You don't touch the wall; you bring a new plug.

Now imagine the alternative: every time you buy a new device, an electrician must come, rip out the wall, and re-wire to handle that *specific* device. You've never seen that — because it would be insane. **That's exactly the design pattern OCP forbids in code.**

The "socket interface" is the abstraction. The appliances are the polymorphic implementations. You can ship an infinite catalog of new devices without ever changing the wiring.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — the growing `switch`

```ts
// ❌ BAD: every new payment method requires editing this method
type PaymentType = "credit_card" | "upi" | "wallet";

class PaymentService {
  pay(type: PaymentType, amount: number): string {
    if (type === "credit_card") {
      // call Stripe
      return "charged via Stripe";
    } else if (type === "upi") {
      // call Razorpay UPI
      return "charged via UPI";
    } else if (type === "wallet") {
      // deduct from internal wallet
      return "deducted from wallet";
    }
    throw new Error(`unknown payment ${type}`);
  }
}
```

What happens when product wants **NetBanking**, **PayPal**, **Crypto**, **EMI**?

- You crack open `PaymentService.pay`.
- Every existing test must be re-run because *this very method changed*.
- Every other file in the codebase that branches on `PaymentType` must also be updated (`switch` exhaustiveness errors cascade).
- A bug in your new EMI branch can break Credit Card payments — they share a function, share a stack frame, share a deploy.

This is the **"shotgun surgery"** code smell: one logical change requires many edits.

### Bad pattern B — flags and special-casing

```ts
// ❌ BAD: feature flags inside business logic
class OrderProcessor {
  process(o: Order) {
    if (this.config.enableLoyalty) {
      o.total *= 0.95;
    }
    if (this.config.enableRegionalTax) {
      o.total += o.total * 0.18;
    }
    if (this.config.enableNewYearPromo) {
      o.total -= 100;
    }
    // ...
  }
}
```

Every product change spawns a new flag and a new conditional. The class accumulates years of toggles. Removing an old flag becomes archaeology.

The deeper problem: each "new feature" is **modifying existing code** (the `process` method) instead of *extending* the system with a new strategy. OCP says: model these as composable rules.

### Bad pattern C — the type-discrimination explosion

```ts
// ❌ BAD: caller fans out on a kind/type field
function area(shape: Shape) {
  if (shape.kind === "circle")   return Math.PI * shape.radius ** 2;
  if (shape.kind === "square")   return shape.side ** 2;
  if (shape.kind === "triangle") return 0.5 * shape.base * shape.height;
  // tomorrow: pentagon? hexagon? ellipse?
}
```

Same disease. Every new shape forces a `area`, `perimeter`, `render`, `serialize` … *everywhere* you branch on `kind`. This was Lesson 03's bad code — it's the OCP violation we exposed back then.

---

## 4. Good Code (the right way)

### Pattern — strategy interface + polymorphic registry

```ts
// ✅ GOOD: the abstraction
interface PaymentProcessor {
  type: string;
  pay(amount: number): Promise<PaymentResult>;
}

// ── concrete strategies, each owns one method ──
class CreditCardProcessor implements PaymentProcessor {
  type = "credit_card";
  async pay(amount: number) { /* Stripe call */ return { ok: true } as PaymentResult; }
}
class UpiProcessor implements PaymentProcessor {
  type = "upi";
  async pay(amount: number) { /* Razorpay UPI */ return { ok: true } as PaymentResult; }
}
class WalletProcessor implements PaymentProcessor {
  type = "wallet";
  async pay(amount: number) { /* internal wallet */ return { ok: true } as PaymentResult; }
}

// ── orchestrator: closed for modification ──
class PaymentService {
  private readonly registry = new Map<string, PaymentProcessor>();

  register(p: PaymentProcessor) {
    this.registry.set(p.type, p);
  }

  async pay(type: string, amount: number) {
    const processor = this.registry.get(type);
    if (!processor) throw new Error(`unknown payment ${type}`);
    return processor.pay(amount);
  }
}

// ── composition root: open for extension ──
const svc = new PaymentService();
svc.register(new CreditCardProcessor());
svc.register(new UpiProcessor());
svc.register(new WalletProcessor());
```

Now — **product asks for PayPal**:

```ts
// just write a new file
class PaypalProcessor implements PaymentProcessor {
  type = "paypal";
  async pay(amount: number) { /* PayPal SDK */ return { ok: true } as PaymentResult; }
}

// register at composition root
svc.register(new PaypalProcessor());
```

`PaymentService` doesn't change. `CreditCardProcessor`, `UpiProcessor`, `WalletProcessor` don't change. Their tests don't re-run. The PR diff is **one new file** + **one new line** at the composition root. *That* is OCP working as designed.

### Pattern — Shape, polymorphic version

```ts
abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape {
  constructor(private readonly r: number) { super(); }
  area() { return Math.PI * this.r ** 2; }
}
class Square extends Shape {
  constructor(private readonly s: number) { super(); }
  area() { return this.s * this.s; }
}

function totalArea(shapes: Shape[]) {
  return shapes.reduce((sum, s) => sum + s.area(), 0);
}

// extension: write a new class. totalArea unchanged.
class Pentagon extends Shape {
  constructor(private readonly side: number) { super(); }
  area() { return (5 * this.side ** 2) / (4 * Math.tan(Math.PI / 5)); }
}
```

Adding `Pentagon` doesn't touch `totalArea`, doesn't touch `Circle`, doesn't touch `Square`. Same lesson, same shape (literally).

### Pattern — pluggable rule chain (for the OrderProcessor flags case)

When you have a *list* of mutating rules, model them as a chain.

```ts
interface PriceRule {
  apply(total: number, order: Order): number;
}

class LoyaltyDiscount implements PriceRule {
  apply(t: number, o: Order) { return o.user.isLoyal ? t * 0.95 : t; }
}
class RegionalTax implements PriceRule {
  apply(t: number, o: Order) { return o.region === "IN" ? t * 1.18 : t; }
}
class NewYearPromo implements PriceRule {
  apply(t: number, o: Order) { return isNewYear() ? t - 100 : t; }
}

class PriceCalculator {
  constructor(private readonly rules: PriceRule[]) {}
  compute(o: Order): number {
    return this.rules.reduce((total, rule) => rule.apply(total, o), o.total);
  }
}

// composition root
const calculator = new PriceCalculator([
  new LoyaltyDiscount(),
  new RegionalTax(),
  new NewYearPromo(),
]);
```

A new rule? Write a new class, prepend/append to the array. `PriceCalculator` is closed; the rule list is open. (This is also the **Chain of Responsibility** pattern; we'll meet it formally in Phase 4.)

### Subtler practice — designing your interface so it stays closed

The point of OCP is *not* that your interface never changes. It's that you choose abstractions that capture the real **dimension of variation**. When you choose well, the abstraction stays stable while many concrete classes accrete underneath.

For payments, the dimension of variation is "how money moves" → `PaymentProcessor.pay(amount)` captures it well.

If you'd over-narrowed and written `pay(card: CreditCard, cvv: string)`, then UPI wouldn't fit, and you'd be back to editing the abstraction every time. **A bad abstraction breaks OCP.**

This is why OCP is not just "use polymorphism" — it's "find the right abstraction."

---

## 5. Real-world Use Cases

- **Express / Koa / NestJS middleware pipelines.** Each middleware is a strategy; the framework's pipeline is closed. Adding logging, auth, rate-limiting = adding new middleware, never editing the framework.
- **AWS Lambda runtime.** AWS doesn't edit the runtime when you add a new Lambda. It dispatches to your handler polymorphically.
- **Plugin systems** (VS Code, Webpack, Rollup, ESLint). The host is closed; plugins extend behavior. The plugin API is the abstraction.
- **Stream and Iterator protocols** in Node and modern JS. `for-of` doesn't know about your custom iterable; it just calls `[Symbol.iterator]()`. New iterables don't change the runtime.
- **React component model.** React core never edits to support your component. It calls `render()` polymorphically. You write a new component → React handles it.
- **Scheduling rules in real-world systems** (Stripe billing rules, Notion automations, Salesforce workflows). Each rule is a polymorphic class; the engine is closed.
- **Splitwise expense splitting.** `EqualSplit`, `ExactSplit`, `PercentageSplit` — each implements a `SplitStrategy`. The settle-up algorithm is closed; new split strategies are extension points. (You'll build this in Phase 7.)

The pattern repeats so often you'll start spotting it everywhere once it's in your eye.

---

## 6. Interview Questions (with answers)

### Q1. *"State the Open/Closed Principle and explain how it can be both 'open' and 'closed' at once."*

**Answer.** OCP says software entities should be **open for extension** (you can add new behavior) but **closed for modification** (without altering the existing, working code). The seeming contradiction resolves through **polymorphism**: you add behavior by writing a *new class* that satisfies an existing abstraction. The original class doesn't change because the new behavior lives in a new place. The "open" is about extending the abstraction's family of implementations; the "closed" is about not editing the existing implementations.

### Q2. *"Show me an OCP violation and the refactor."*

**Answer.** A growing `switch`/`if-else` is the textbook violation:

```ts
// ❌
function getDiscount(type: string, total: number) {
  if (type === "loyalty") return total * 0.05;
  if (type === "newyear") return total - 100;
  // every new promo edits this function
}
```

Refactor: model each promo as a `DiscountRule` strategy.

```ts
// ✅
interface DiscountRule { apply(total: number): number; }
class LoyaltyDiscount implements DiscountRule { apply(t: number) { return t * 0.05; } }
class NewYearPromo implements DiscountRule { apply(t: number) { return 100; } }

function getDiscount(rule: DiscountRule, total: number) { return rule.apply(total); }
```

Adding a new promo is one new class. The dispatch function never changes.

### Q3. *"How does OCP relate to polymorphism?"*

**Answer.** Polymorphism is the **mechanism**; OCP is the **discipline**. Polymorphism gives you the ability to dispatch a single call to many concrete implementations at runtime. OCP says: *use that ability so that new requirements arrive as new classes, not as edits to old ones.* Without polymorphism, OCP is impossible. Without OCP discipline, polymorphism is just a feature you don't take advantage of.

### Q4. *"When would over-applying OCP hurt you?"*

**Answer.** Three real risks:
1. **Premature abstraction.** Building extension points for variations that never arrive — you pay the indirection cost and get nothing back. Apply OCP at predictable extension points (payment methods, notification channels, discount rules) — not at every helper.
2. **Wrong abstraction.** If you choose the wrong dimension to abstract over, every new variant fights the abstraction. Worse than no abstraction. The fix is to refactor the abstraction; admit you got it wrong, change it once, restore stability.
3. **Cognitive load.** Every layer of indirection costs the next reader. A 5-line `if` may genuinely be clearer than three classes + a registry, *if* the variants will never grow. Use judgment.

The senior engineer's heuristic: **wait for the third variant** before extracting an abstraction. One is a number; two is a coincidence; three is a pattern.

### Q5. *"How do SRP and OCP support each other?"*

**Answer.** They tend to succeed or fail together:

- A class that follows SRP (one reason to change) is *small* and *focused*. Such a class is easier to **swap** rather than edit, which is exactly OCP.
- A class that violates SRP is a god class. It's bloated, it's tested as a single block, and it has too many "extension dimensions." Every new feature forces edits in ten places — the opposite of OCP.

If your design follows SRP rigorously, OCP usually falls into your lap. Conversely, if you're struggling to honor OCP, look for an SRP violation upstream — chances are a class is doing too much.

### Q6. *"Walk me through how a 'plugin' architecture (VS Code, ESLint, Webpack) embodies OCP."*

**Answer.** A plugin host is *closed*: its core code doesn't change every time someone writes a new plugin. The plugin API — a stable interface (`Plugin`, `Rule`, `Loader`) — is the abstraction. Every plugin is a new class implementing that interface. The host loads plugins at runtime via a registry and dispatches polymorphically. New plugin → new file. Host unchanged. This is OCP at architectural scale — the same shape as the `PaymentProcessor` registry above, scaled to thousands of independent extensions.

### Q7. *"What's the smell that tells you a piece of code violates OCP?"*

**Answer.** Several reliable smells:
- A `switch` or `if-else` ladder on a "type" or "kind" field.
- A method that gains a new branch every quarter.
- A class whose tests need updating every time a new variant is added (rather than just a new test file for the new variant).
- "We added a flag" PR descriptions becoming routine.
- Code review comments that say "remember to also update X, Y, Z" — implicit shotgun surgery.

When you see these, the fix is almost always: **extract the dimension of variation into an abstraction, and turn each branch into a polymorphic class.**

---

## Recap — what to remember

1. **OCP — open for extension, closed for modification.** Add new code, don't edit old.
2. The mechanism is **polymorphism**: callers depend on an abstraction; new behavior is a new concrete class.
3. The most common violation is a **growing `switch`** that fans out on a type/kind field.
4. The fix is a **strategy interface** + a **registry** (or a chain, or a list) at the composition root.
5. **A bad abstraction breaks OCP** — choose the right *dimension of variation* (e.g., "how money moves", not "credit card vs wallet").
6. Apply OCP at **predictable extension points**, not everywhere. **Wait for the third variant.**
7. **SRP and OCP succeed or fail together.** A focused class is also a swappable class.

---

## What's next
Lesson 12 — **SOLID: L — the Liskov Substitution Principle**: when "Square is-a Rectangle" silently breaks your code, the Bird/Penguin trap, and how to spot LSP violations in interviews.
