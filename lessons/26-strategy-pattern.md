# 26 — Strategy Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, **most-used pattern in LLD interviews**

---

## 1. Concept / Theory

**Strategy** defines a family of interchangeable algorithms, encapsulates each one as a separate object, and lets the client pick which one to use **at runtime**. The client doesn't change; only the strategy plugged into it does.

The pattern shows up wherever you find yourself thinking *"I have several different ways to do X, and I want to pick one based on input/config."*

* Multiple **payment methods** (UPI, Card, PayPal, ApplePay).
* Multiple **shipping options** (standard, express, overnight, in-store pickup).
* Multiple **pricing rules** (regular, member, seasonal, holiday).
* Multiple **sorting algorithms** (by name, by date, by relevance score).
* Multiple **compression / encryption schemes** (gzip, brotli, lz4 / AES, RSA).
* Multiple **routing modes** in a map app (walking, driving, transit, cycling).
* Multiple **auth strategies** (password, OAuth, SAML, magic link).

Strategy is your default answer to *"how do I avoid `switch` on type?"*

```
   ┌─────────────┐                  ┌──────────────┐
   │   Context   │─────uses────────▶│   Strategy   │  (interface)
   │             │                  └──────┬───────┘
   │ executeOp() │                         △
   └─────────────┘                  ┌──────┴───────┬──────────────┐
                                    │              │              │
                              ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │StrategyA │   │StrategyB │   │StrategyC │
                              └──────────┘   └──────────┘   └──────────┘
```

The Context holds a reference to a Strategy (typically injected). When the Context runs its operation, it delegates the variable part to the strategy. Swapping the strategy swaps the algorithm, no Context changes needed.

### Why interviewers love this pattern

Strategy is the **mechanical answer** to violations of the Open/Closed Principle. Every "the system has many similar things and we add new variants regularly" question collapses to: define a Strategy interface, write a class per variant, inject the right one. It's the cleanest demonstration that you understand how to make a system *open for extension, closed for modification*.

### The TypeScript twist

In Java/C#, Strategy is a class hierarchy: an interface plus N concrete classes. In JS/TS, **a strategy is often just a function**. `Array.prototype.sort(compareFn)` is the canonical example — `compareFn` is a strategy. RxJS, Lodash, React event handlers, all of these accept callbacks that *are* strategies in disguise.

Both forms are valid. Use the class form when:

* The strategy has **state** or **dependencies** (talks to a DB, reads config).
* You need to **swap implementations polymorphically**, possibly via DI.
* The strategy has **multiple methods**, not just one.

Use the function form when:

* The algorithm is **stateless**.
* It has **one operation**.
* You don't need DI / polymorphism — just behavior.

### Strategy vs State (the most-asked confusion)

Strategy and State look mechanically identical: a Context holds a reference to a wrapped object that varies behavior. The difference is *who chooses* and *when*.

* **Strategy** — the *client* picks which strategy to plug in, usually once, externally. Strategies don't know about each other.
* **State** — the object *transitions* between states based on its own behavior. States know about other states or about the context's transitions.

Example: a vending machine's "accept coin" behavior changes based on its state (`Idle`, `HasCoin`, `Dispensing`) — that's State. A vending machine's "compute price" varies by pricing model (regular, member, holiday) chosen at install time — that's Strategy.

We'll cover State in detail in Lesson 28; for now, just remember: Strategy is *picked from outside*, State is *driven by internal transitions*.

---

## 2. Real-life Analogy

**Google Maps' route options.** You enter a destination, then pick a mode: driving, transit, walking, cycling, ride-share. The interface — "show me a route" — is unchanged. Each mode is a different *algorithm* for computing a route. You can switch modes without leaving the screen.

The app doesn't have a giant `if (mode === "drive") { ... } else if (mode === "transit") { ... }` block. It has a `Router` interface and a separate implementation for each mode. Adding "scooter routes" is a new file, not a refactor.

Other clean analogies:

* **Restaurant menu — "How would you like your steak?"** Rare, medium, well done are three strategies for the same operation (cooking). The kitchen workflow is the Context.
* **Tax calculation.** Same income, different jurisdictions → different tax algorithms. Pick the strategy by country/state.
* **Sorting library books.** By author, title, genre, year. Same shelf, different ordering algorithms.

---

## 3. Bad Code Example — Algorithm-Selection by `switch`

This is the anti-pattern Strategy fixes. `if`/`switch` chains scattered through the code, every algorithm hard-coded into the same big method.

```ts
// ❌ BAD: payment logic dispatched by string switching
class CheckoutService {
  pay(method: string, userId: string, amount: number) {
    if (method === "card") {
      // 10 lines of card-payment logic, talking to Stripe
      console.log(`Charging $${amount} to card`);
    } else if (method === "upi") {
      // 12 lines of UPI logic, talking to a different SDK
      console.log(`UPI debit of ₹${amount * 83}`);
    } else if (method === "paypal") {
      // 15 lines of PayPal flow
      console.log(`PayPal redirect for $${amount}`);
    } else if (method === "applepay") {
      // 8 lines of Apple Pay flow
      console.log(`Apple Pay for $${amount}`);
    } else {
      throw new Error("Unknown method");
    }
    // common code: log, send email, return receipt
  }

  refund(method: string, txnId: string) {
    if (method === "card") { /* card refund */ }
    else if (method === "upi") { /* UPI refund */ }
    else if (method === "paypal") { /* PayPal refund */ }
    // ... same switch, copy-pasted
  }
}
```

What's wrong:

1. **OCP violation.** Adding `crypto` payments edits *every* method that switches on `method`.
2. **Big method that does many things.** `pay()` has hundreds of lines mixing four unrelated payment flows. SRP violation.
3. **Difficult to test.** Each branch needs its own setup, mocks, fixtures — but they all live in one method.
4. **No polymorphism.** The system can't ask "does this payment method support refunds?" without another switch.
5. **Type-unsafe.** `method: string` accepts anything — typo in caller, runtime error.

Sound familiar? It's the same diagnosis as Lesson 17 (Factory). Strategy is what you reach for when the *thing being switched on* is an algorithm rather than a class to instantiate. Often you'll combine them: a Factory builds the right Strategy.

---

## 4. Good Code Example — Strategy in TypeScript

### 4a. Class-based Strategy (the textbook form)

```ts
// ============================================================
// 1) Strategy interface — the "contract" all algorithms share
// ============================================================
interface PaymentStrategy {
  pay(userId: string, amountInDollars: number): Promise<{ txRef: string }>;
  supportsRefund(): boolean;
}

// ============================================================
// 2) Concrete strategies
// ============================================================
class CardPaymentStrategy implements PaymentStrategy {
  constructor(private apiKey: string) {}
  async pay(userId: string, amount: number) {
    // talk to Stripe
    return { txRef: `card_${Date.now()}` };
  }
  supportsRefund() { return true; }
}

class UpiPaymentStrategy implements PaymentStrategy {
  constructor(private merchantId: string) {}
  async pay(userId: string, amount: number) {
    return { txRef: `upi_${Date.now()}` };
  }
  supportsRefund() { return true; }
}

class CryptoPaymentStrategy implements PaymentStrategy {
  async pay(userId: string, amount: number) {
    return { txRef: `crypto_${Date.now()}` };
  }
  supportsRefund() { return false; }   // crypto refunds are non-trivial
}

// ============================================================
// 3) Context — uses a Strategy without knowing which concrete one
// ============================================================
class CheckoutService {
  constructor(private strategy: PaymentStrategy) {}

  async checkout(userId: string, amount: number) {
    const { txRef } = await this.strategy.pay(userId, amount);
    console.log(`Payment ok: ${txRef}, refundable: ${this.strategy.supportsRefund()}`);
    return txRef;
  }
}

// ============================================================
// 4) Usage — the strategy is INJECTED
// ============================================================
const checkoutWithCard   = new CheckoutService(new CardPaymentStrategy("sk_xxx"));
const checkoutWithUpi    = new CheckoutService(new UpiPaymentStrategy("merch_yyy"));
const checkoutWithCrypto = new CheckoutService(new CryptoPaymentStrategy());

await checkoutWithCard.checkout("user1", 99);
await checkoutWithCrypto.checkout("user2", 250);
```

What changed from the bad version:

* **Each algorithm is its own class** with one focused responsibility.
* **`CheckoutService` has zero `if (method === ...)` logic.** It just delegates to whichever strategy was injected.
* **Adding `ApplePayStrategy`** is one new class — no `CheckoutService` change.
* **Each strategy has its own dependencies.** Card needs a Stripe API key; UPI needs a merchant id. They're injected per-strategy, not piled into the Context.
* **`supportsRefund()` is polymorphic.** No second switch needed.

### 4b. Function-based Strategy (the idiomatic JS form)

When the strategy is stateless and has a single operation, just pass a function.

```ts
type Comparator<T> = (a: T, b: T) => number;

const byName:    Comparator<{ name: string }>      = (a, b) => a.name.localeCompare(b.name);
const byPrice:   Comparator<{ price: number }>     = (a, b) => a.price - b.price;
const byDate:    Comparator<{ created: Date }>     = (a, b) => a.created.getTime() - b.created.getTime();

class ProductList {
  constructor(private items: { name: string; price: number; created: Date }[]) {}
  sorted(cmp: Comparator<{ name: string; price: number; created: Date }>) {
    return [...this.items].sort(cmp);
  }
}

const list = new ProductList([...]);
list.sorted(byPrice);
list.sorted(byName);

// Built into the language: Array.prototype.sort takes a Strategy.
[3, 1, 2].sort((a, b) => a - b);
```

This *is* the Strategy pattern. Same structure, no class ceremony.

### 4c. Strategy Registry (combining with Factory)

In production, you usually want a key-based lookup so callers can request "give me strategy `'crypto'`" without knowing the class.

```ts
class PaymentStrategyRegistry {
  private strategies = new Map<string, PaymentStrategy>();
  register(key: string, strategy: PaymentStrategy) { this.strategies.set(key, strategy); }
  get(key: string): PaymentStrategy {
    const s = this.strategies.get(key);
    if (!s) throw new Error(`Unknown payment method: ${key}`);
    return s;
  }
}

const reg = new PaymentStrategyRegistry();
reg.register("card",   new CardPaymentStrategy("sk_xxx"));
reg.register("upi",    new UpiPaymentStrategy("merch_yyy"));
reg.register("crypto", new CryptoPaymentStrategy());

class CheckoutController {
  constructor(private registry: PaymentStrategyRegistry) {}
  async checkout(userId: string, method: string, amount: number) {
    const strategy = this.registry.get(method);
    return new CheckoutService(strategy).checkout(userId, amount);
  }
}
```

This is **Strategy + Factory + Registry** stacked. Every production payment system in real codebases looks essentially like this.

### 4d. Discount calculation (real-world business strategy)

```ts
interface DiscountStrategy {
  apply(originalPrice: number, customer: Customer): number;
}

class NoDiscount implements DiscountStrategy {
  apply(p: number) { return p; }
}

class MemberDiscount implements DiscountStrategy {
  constructor(private percent: number) {}
  apply(p: number, c: Customer) { return c.isMember ? p * (1 - this.percent / 100) : p; }
}

class HolidayDiscount implements DiscountStrategy {
  constructor(private percent: number, private fromDate: Date, private toDate: Date) {}
  apply(p: number) {
    const now = new Date();
    return now >= this.fromDate && now <= this.toDate ? p * (1 - this.percent / 100) : p;
  }
}

class CompositeDiscount implements DiscountStrategy {
  constructor(private strategies: DiscountStrategy[]) {}
  apply(p: number, c: Customer) {
    return this.strategies.reduce((price, s) => s.apply(price, c), p);
  }
}

const blackFridayMember = new CompositeDiscount([
  new MemberDiscount(10),                                            // 10% if member
  new HolidayDiscount(20, new Date("2026-11-27"), new Date("2026-11-28")), // 20% on Black Friday
]);

console.log(blackFridayMember.apply(100, { isMember: true } as any));   // 72
```

Notice the last bit: `CompositeDiscount` is a Strategy that *itself contains* other strategies. That's Strategy + Composite stacking elegantly.

### 4e. Context can swap strategies at runtime

```ts
class Navigator {
  private strategy: RouteStrategy;
  constructor(initial: RouteStrategy) { this.strategy = initial; }

  setStrategy(s: RouteStrategy) { this.strategy = s; }   // swap on the fly
  buildRoute(from: GeoPoint, to: GeoPoint) { return this.strategy.compute(from, to); }
}

const nav = new Navigator(new DrivingRoute());
nav.buildRoute(home, work);
nav.setStrategy(new TransitRoute());   // user toggles UI
nav.buildRoute(home, work);
```

Strategies don't have to be set once at construction. The Context can let users switch them — that's exactly the Maps app behavior.

---

## 5. Real-world Use Cases

* **`Array.prototype.sort(compareFn)`** — comparison strategy, baked into the language.
* **`Array.prototype.filter / map / reduce`** — every callback is a strategy.
* **Passport.js authentication** — literally named "strategies." `passport.use(new GoogleStrategy(...))`, `LocalStrategy`, `JWTStrategy`, etc.
* **Payment processors** — Stripe / Razorpay / PayPal / ApplePay all behind a Strategy interface.
* **Validation libraries** — Yup, Zod schemas: each schema is essentially a validation strategy.
* **Compression** — picking gzip vs brotli vs deflate per content type / client header.
* **Encryption** — picking AES-128 vs AES-256 vs RSA per security requirement.
* **Caching strategies** — LRU vs LFU vs FIFO; same `Cache` interface, different eviction.
* **Routing strategies** — Google Maps walk/drive/transit/bike; Apple Maps; Uber's route choice.
* **Pricing models** — surge pricing for Uber, dynamic pricing in airlines, regular vs member vs holiday discounts.
* **Recommendation engines** — collaborative filtering vs content-based vs hybrid; same `recommend(user)` interface.
* **State of the art ML inference** — runtime can pick `WASMBackend`, `CPUBackend`, `WebGPUBackend` for the same model interface.
* **Frontend form validators** — `email`, `phone`, `creditCard` validators all behind one `Validator` strategy.
* **CSV / JSON / XML serializers** — same `serialize(data)` interface, different formats.
* **Test data factories** — `RandomUserFactory`, `AdminUserFactory`, `BannedUserFactory` strategies for generating test users.
* **Currency formatting** — different `Intl.NumberFormat` strategies per locale.
* **Search relevance ranking** — BM25 vs TF-IDF vs embedding-based; same `rank(query, docs)` interface.
* **Express / Koa / Fastify** — middleware *functions* are strategies for each pipeline step.

In any codebase, anytime you see a constructor parameter named like `Comparator`, `Validator`, `Strategy`, `Provider`, `Resolver`, `Algorithm`, `Mode`, `Policy`, `Selector`, or `Handler` — you're staring at a Strategy.

---

## 6. Interview Questions

### Q1. What's the difference between Strategy and State?

**Answer:** They look identical structurally — a Context holds a reference to a varying object — but their *intent* differs.

* **Strategy** — the *client* picks the algorithm, externally and usually once. Different strategies don't know about each other; they're independent. The Context's behavior changes because someone *plugged in* a different strategy.
* **State** — the *object* transitions between states based on internal events. States typically know about other states (or about the Context's transition method) and trigger transitions themselves. The Context's behavior changes because *something happened* internally.

Concrete example:

* A document editor's **save format** (PDF / Word / Markdown) → Strategy. The user picks once, the editor uses it.
* A document editor's **edit mode** (Drafting → Reviewing → Approved) → State. Each state controls what operations are allowed and triggers transitions to the next state.

Mechanical rule of thumb: if there's a `setState()` or `transitionTo()` call inside the state objects themselves, it's State. If swapping happens entirely from outside, it's Strategy.

---

### Q2. What's the difference between Strategy and Template Method?

**Answer:** Both let you vary an algorithm — but at different *levels of structure*.

* **Strategy** — the *whole* algorithm is replaceable. Pluggable; varies by composition (the Context holds a Strategy reference).
* **Template Method** — the algorithm's *skeleton* is fixed in a base class; only specific *steps* are overridden by subclasses. Varies by inheritance.

Example: an HTTP request lifecycle. The skeleton (parse URL → resolve DNS → open socket → send request → read response → close socket) is the same. What varies might be just "how do you authenticate?" — that's a single overridable step → Template Method.

If, instead, the *entire* "make a request" algorithm could swap (HTTP/1, HTTP/2, HTTP/3) — that's Strategy.

In practice, modern code prefers Strategy + composition over Template Method + inheritance, because composition is more flexible and avoids tight coupling. Template Method still has its place for genuine "fixed skeleton, plug in steps" workflows.

---

### Q3. In TypeScript, why would I write a Strategy as a class instead of just a function?

**Answer:** A function suffices when the strategy is stateless and has a single operation. Use the class form when:

1. **The strategy has state.** A `RetryStrategy` that tracks attempts; a `RateLimitStrategy` that tracks bucket fills; a `CachingStrategy` with internal storage.
2. **The strategy has multiple methods.** A `PaymentStrategy` might need `pay()`, `refund()`, `supportsPartial()`. A function can't expose multiple operations cleanly.
3. **The strategy has dependencies.** A `StripePaymentStrategy` needs an API key, an HTTP client, a logger. Class constructors are the natural place for DI.
4. **The strategy needs to be registered/discoverable.** A registry keyed by string is more natural with class instances than with bare functions.
5. **You want polymorphism + `instanceof` checks** for type narrowing or debugging.

Functions win on:

* **Stateless, one-shot operations** (`compareFn`, `predicate`, `mapper`).
* **Inline use** where DI is overkill.
* **Composability** — function chains and pipes are very natural in JS/TS.

The senior framing: pick the lighter-weight form unless the strategy needs something only a class gives you. Don't write a 30-line class with one method when a 3-line arrow function works.

---

### Q4. Walk me through implementing a notification system using Strategy.

**Answer:**

```ts
interface NotificationStrategy {
  send(user: User, message: string): Promise<void>;
}

class EmailNotification implements NotificationStrategy {
  constructor(private mailer: Mailer) {}
  async send(user: User, message: string) { await this.mailer.send(user.email, message); }
}

class SmsNotification implements NotificationStrategy {
  constructor(private twilio: TwilioClient) {}
  async send(user: User, message: string) { await this.twilio.sms(user.phone, message); }
}

class PushNotification implements NotificationStrategy {
  constructor(private fcm: FCMClient) {}
  async send(user: User, message: string) { await this.fcm.push(user.deviceToken, message); }
}

class SlackNotification implements NotificationStrategy {
  constructor(private webhook: string) {}
  async send(user: User, message: string) {
    await fetch(this.webhook, { method: "POST", body: JSON.stringify({ user: user.id, message }) });
  }
}

class NotificationService {
  constructor(private strategy: NotificationStrategy) {}
  async notify(user: User, message: string) { await this.strategy.send(user, message); }
}
```

Then I'd anticipate the obvious follow-ups:

* **Multi-channel.** "What if a user wants email *and* SMS?" → Composite Strategy: `class MultiChannel implements NotificationStrategy { constructor(private strategies: NotificationStrategy[]) {} async send(...) { await Promise.all(this.strategies.map(s => s.send(...))) } }`. That's Strategy + Composite, which we did in the discount example.
* **Per-user preference.** "Different users want different channels." → A registry keyed by user preference, picked per call.
* **Fallback.** "If push fails, fall back to email." → Decorator wrapping a strategy: `FallbackStrategy(primary, fallback)` tries primary, on failure tries fallback. Strategy + Decorator.
* **Retries / rate limiting.** Decorators around the strategy.
* **Templates.** Notification template rendering is its own concern — pull it out into a `MessageRenderer` and inject into each strategy. Don't mix template logic with delivery.

That last set of follow-ups is what separates a 4/5 from a 5/5. Show that you can extend the design without rewriting it.

---

### Q5. When is Strategy NOT the right pattern?

**Answer:** A few situations where Strategy adds noise without benefit:

1. **Only one variant exists and no realistic plan for more.** Don't add a Strategy interface if there's only ever going to be `RegularDiscount`. YAGNI. Add it the day a second variant is needed.
2. **The variation isn't an algorithm — it's data.** If the only difference between "variants" is parameter values, parameterize the function instead. `flatDiscount(percent: number)` is not three strategies; it's one function with a parameter.
3. **The strategies share so much code that the class hierarchy becomes the dominant feature.** That's a Template Method situation, not Strategy. If 80% of two strategies' code is duplicated, the variation is in *steps*, not the *whole algorithm* — refactor.
4. **The "strategy" reaches deeply into the Context.** If the strategy needs five fields from the Context, an `Action` callback that takes the Context object as a parameter, you've inverted the relationship — the Context is now the parameter. It might be a Visitor (Lesson 33 territory) rather than a Strategy.
5. **Performance-sensitive hot paths.** Class-based Strategy adds a virtual dispatch per call. In tight loops (game render, audio processing), inlining or branch tables can be faster. Profile before adding indirection.

The honest framing: Strategy is the most-overused pattern in interview *answers* (because it's safe). Show in interviews that you reach for it when there's *real* multiplicity — and that you know when it would just add ceremony.

---

## TL;DR Cheat Sheet

```
Strategy: define a family of algorithms, encapsulate each, make them
          interchangeable at runtime.

Recipe:
  1. Strategy interface — the operation contract
  2. Concrete Strategies — one class per algorithm
  3. Context — holds a Strategy reference, delegates to it
  4. Client picks/injects the strategy

Use when:
  - many ways to do the same operation (payment, sort, encrypt, route)
  - you want to add new variants without modifying existing code (OCP)
  - dispatch-by-type switch statements are appearing in your code

Don't use when:
  - only one variant, no more planned (YAGNI)
  - variation is parameter values, not algorithms
  - tight loops where dispatch overhead matters

vs State: same shape, different intent.
  - Strategy: client picks externally, no transitions.
  - State: object self-transitions internally.

vs Template Method: T.M. fixes the skeleton + overridable steps;
                    Strategy replaces the WHOLE algorithm.

In TypeScript:
  - Function form is fine when stateless + single operation
  - Class form when stateful, multi-method, or DI-needed

Combines well with:
  - Factory/Registry: choose strategy by key
  - Composite: a strategy that contains strategies (e.g., discount stack)
  - Decorator: wrap a strategy with retries/logging/fallback

Real-world: Array.sort, Passport.js, payment gateways, validators,
            compression, routing, pricing rules, every callback ever.

Interview gold: "I'd model the variants behind a Strategy interface,
                 inject via DI, optionally key them in a registry, and
                 compose them with Composite/Decorator if multi-channel
                 or fallback is needed."
```
