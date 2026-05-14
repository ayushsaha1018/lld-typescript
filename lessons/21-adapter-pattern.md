# 21 — Adapter Pattern

> Phase 4 — Design Patterns → Structural
> Pattern type: Structural
> Difficulty: Easy concept, extremely common in real code

---

## 1. Concept / Theory

**Adapter** lets two incompatible interfaces work together. You wrap an existing class (the **adaptee**) with a new class (the **adapter**) that exposes the interface your code expects (the **target**).

The pattern shows up whenever:

* You're integrating a **third-party library** whose API doesn't match the rest of your code.
* You're working with a **legacy module** you can't (or shouldn't) modify.
* You want to **swap implementations** without rewriting callers — Stripe today, Razorpay tomorrow, mock in tests.
* Two parts of the same codebase grew with **different conventions** (camelCase vs snake_case, Promises vs callbacks, sync vs async).

The key insight: you don't change the adaptee, you don't change the client — you slip a translator between them.

```
┌─────────┐   expects    ┌──────────┐
│ Client  │ ───────────▷ │ Target   │  (the interface our app uses)
└─────────┘              └────┬─────┘
                              △
                              │ implements
                       ┌──────┴──────┐         delegates    ┌──────────────┐
                       │   Adapter   │ ─────────────────▷  │   Adaptee    │  (third-party / legacy)
                       └─────────────┘                      └──────────────┘
```

### Two flavors

* **Object Adapter** — the adapter *contains* an adaptee instance and delegates calls to it. Uses **composition**. The form you'll always use in TS.
* **Class Adapter** — the adapter *inherits* from both the target and the adaptee. Requires multiple inheritance, which TS doesn't have (and Java doesn't either). Mostly a C++ thing. Mention it in interviews for completeness; in TS, always object adapter.

### Adapter is "translation," not "addition"

Don't confuse Adapter with Decorator (next lesson) or Facade.

* **Adapter** — same behavior, *different interface*. The adaptee already does what you need; you're just renaming/reshaping its API.
* **Decorator** — same interface, *added behavior*. Logging, caching, retries.
* **Facade** — *simpler* interface over a *complex* subsystem. Hides multiple classes behind one entry point.

If you find yourself adding meaningful new logic in your adapter (transformations, aggregation, business rules), it's drifting toward Facade or Decorator territory.

---

## 2. Real-life Analogy

The most literal analogy is a **power plug adapter**. You bought a laptop in India (Type C plug). You're in the US (Type B socket). You don't open the laptop and rewire it; you don't swap out the wall socket. You buy a $5 adapter that translates between them. Both sides are unchanged; the adapter just makes them connectable.

Other clean analogies:

* **USB-C to USB-A dongle.** Same data, two physical interfaces.
* **Translator at a meeting.** The Japanese delegate speaks Japanese; the German delegate speaks German. The translator (adapter) makes communication possible without changing either delegate.
* **An audio jack splitter.** Same signal, different connector.

---

## 3. Bad Code Example — Letting the Adaptee Bleed Through

This is what code looks like when you skip the Adapter and let the third-party API leak everywhere.

```ts
// Third-party SDK we're stuck with — has its own quirky API
class LegacyPaymentSDK {
  // snake_case keys, callbacks, returns a verbose object
  make_payment(params: { amount_in_cents: number; currency_code: string },
               on_done: (err: Error | null, result?: { ok: boolean; tx_ref: string }) => void) {
    // imagine HTTP calls...
    setTimeout(() => on_done(null, { ok: true, tx_ref: "LEGACY_" + Date.now() }), 50);
  }
}

// Our codebase — directly using the SDK's quirky API
class CheckoutController {
  pay(amountInDollars: number) {
    const sdk = new LegacyPaymentSDK();
    sdk.make_payment(
      { amount_in_cents: amountInDollars * 100, currency_code: "USD" },
      (err, result) => {
        if (err || !result?.ok) { /* handle */ return; }
        console.log("paid:", result.tx_ref);
      }
    );
  }
}

class SubscriptionRenewer {
  renew(plan: { price: number }) {
    const sdk = new LegacyPaymentSDK();
    sdk.make_payment(
      { amount_in_cents: plan.price * 100, currency_code: "USD" },
      // SAME conversion, SAME callback dance, COPY-PASTED
      (err, result) => {
        if (err || !result?.ok) { /* handle */ return; }
      }
    );
  }
}
```

What's wrong:

1. **Naming convention pollution.** The SDK's snake_case sneaks into the rest of the app — every caller does `amount_in_cents` and `currency_code` mentally.
2. **API style mismatch.** The SDK uses callbacks; the rest of the app is presumably promise-based. Every caller does the callback dance.
3. **Conversion logic duplicated.** Dollar-to-cents, currency code defaulting, error normalization — repeated everywhere.
4. **Locked in.** Replacing the SDK with Stripe means editing every caller.
5. **Testing pain.** Mocking a callback-based SDK that's instantiated inline is awful. You can't inject a fake.

---

## 4. Good Code Example — Adapter in TypeScript

### 4a. Object Adapter (the workhorse)

```ts
// =====================================================
// 1) Target — the interface our app expects to use
// =====================================================
interface PaymentGateway {
  charge(amountInDollars: number, currency: string): Promise<{ txRef: string }>;
}

// =====================================================
// 2) Adaptee — the third-party SDK (unchanged)
// =====================================================
class LegacyPaymentSDK {
  make_payment(
    params: { amount_in_cents: number; currency_code: string },
    on_done: (err: Error | null, result?: { ok: boolean; tx_ref: string }) => void,
  ) {
    setTimeout(() => on_done(null, { ok: true, tx_ref: "LEGACY_" + Date.now() }), 50);
  }
}

// =====================================================
// 3) Adapter — implements Target, delegates to Adaptee
// =====================================================
class LegacyPaymentAdapter implements PaymentGateway {
  constructor(private sdk: LegacyPaymentSDK) {}

  charge(amountInDollars: number, currency: string): Promise<{ txRef: string }> {
    return new Promise((resolve, reject) => {
      this.sdk.make_payment(
        { amount_in_cents: amountInDollars * 100, currency_code: currency },
        (err, result) => {
          if (err) return reject(err);
          if (!result?.ok) return reject(new Error("payment failed"));
          resolve({ txRef: result.tx_ref });
        },
      );
    });
  }
}

// =====================================================
// 4) Client — depends only on the Target interface
// =====================================================
class CheckoutController {
  constructor(private gateway: PaymentGateway) {}
  async pay(amount: number) {
    const { txRef } = await this.gateway.charge(amount, "USD");
    console.log("paid:", txRef);
  }
}

// =====================================================
// 5) Composition root — wires it all up
// =====================================================
const checkout = new CheckoutController(new LegacyPaymentAdapter(new LegacyPaymentSDK()));
checkout.pay(99);
```

What this buys:

* **CheckoutController has no idea what gateway is underneath.** Stripe? PayPal? Mock? It's the same code.
* **All translation lives in one place** — the adapter. Conversion of dollars→cents, callback→promise, snake→camel, error normalization.
* **Swapping providers is trivial.** Write `StripeAdapter implements PaymentGateway`, change one line in the composition root.
* **Tests pass `MockGateway`** instead of standing up the SDK.

### 4b. Adapter for multiple providers

This is what every payment system, logging system, and email system in production looks like.

```ts
// shared target
interface PaymentGateway {
  charge(amountInDollars: number, currency: string): Promise<{ txRef: string }>;
}

// adapter for Stripe (modern API, already promise-based, USD in cents)
class StripeAdapter implements PaymentGateway {
  constructor(private stripe: { paymentIntents: { create: (p: any) => Promise<any> } }) {}
  async charge(amountInDollars: number, currency: string) {
    const intent = await this.stripe.paymentIntents.create({
      amount: amountInDollars * 100,
      currency: currency.toLowerCase(),
    });
    return { txRef: intent.id };
  }
}

// adapter for Razorpay (rupees, paise, different API surface)
class RazorpayAdapter implements PaymentGateway {
  constructor(private razorpay: { orders: { create: (p: any) => Promise<any> } }) {}
  async charge(amountInDollars: number, currency: string) {
    // imagine FX conversion if needed; here we assume currency already correct
    const order = await this.razorpay.orders.create({
      amount: Math.round(amountInDollars * 100),
      currency,
    });
    return { txRef: order.id };
  }
}

// adapter for tests — a fake
class FakeGateway implements PaymentGateway {
  async charge(): Promise<{ txRef: string }> { return { txRef: "TEST_" + Date.now() }; }
}
```

The application code never sees `Stripe`, `Razorpay`, or `LegacyPaymentSDK` — only `PaymentGateway`. That's the win.

### 4c. Two-way Adapter

If both sides need to talk to each other in their own dialect, an adapter can implement *both* interfaces. Rare but real — e.g., adapting a class to fit two different frameworks at once.

```ts
interface Logger    { log(msg: string): void; }
interface Tracer    { trace(level: string, payload: object): void; }

class LegacyLoggingService {
  write(level: string, line: string) { console.log(`[${level}] ${line}`); }
}

class TwoWayAdapter implements Logger, Tracer {
  constructor(private legacy: LegacyLoggingService) {}
  log(msg: string)              { this.legacy.write("info", msg); }
  trace(level: string, p: object) { this.legacy.write(level, JSON.stringify(p)); }
}
```

Mention this exists; rarely worth implementing.

---

## 5. Real-world Use Cases

* **Payment gateways** — Stripe, PayPal, Razorpay, Adyen all wrapped behind one `PaymentGateway` interface. The single biggest real-world Adapter use case.
* **Logging** — Winston, Pino, Bunyan, console. Every app has an `ILogger` interface and adapters for whichever backend.
* **Date libraries** — moment, dayjs, date-fns, Luxon all wrapped behind a `DateUtils` interface so you can migrate later (very common after moment.js was deprecated).
* **HTTP clients** — `axios`, `fetch`, `got` adapted to a uniform `HttpClient` so swapping is painless.
* **i18n / localization** — `react-i18next`, `formatjs`, custom systems all behind `t(key, vars)`.
* **Database / ORM** — TypeORM, Prisma, Mongoose internally use adapters to abstract over Postgres/MySQL/Mongo drivers. (Combined with Abstract Factory at the family level.)
* **React Native** — the platform itself is one giant Adapter layer: JS calls a unified API, the bridge translates to UIKit on iOS or Android Views.
* **Redux middleware** — `redux-thunk`, `redux-saga`, `redux-observable`, RTK Query — all adapters that translate side-effect descriptions into a `dispatch`-compatible flow.
* **Cloud SDKs** — wrapping AWS SDK, Google Cloud SDK, Azure SDK behind a uniform `BlobStore` or `Queue` interface for multi-cloud portability.
* **Auth providers** — Clerk, Auth0, Firebase Auth, Cognito all behind an `AuthProvider` interface.
* **Analytics** — Segment.com is essentially a hosted Adapter — one API, dozens of downstream destinations.
* **Plugin systems** — VSCode extensions, Webpack loaders, Babel plugins. Each plugin adapts a foreign API to the host's plugin contract.

If you're at Magnifi.ai and wired any third-party SDK into the codebase, the answer to "did I use Adapter?" is almost certainly yes.

---

## 6. Interview Questions

### Q1. Adapter vs Decorator vs Facade — what's the difference?

**Answer:** All three are structural patterns where one class wraps another, but their *intent* differs.

* **Adapter** — same behavior, *different interface*. The wrapped object already does what you need; the adapter only translates the API. Used when integrating incompatible code.
* **Decorator** — same interface, *added behavior*. The wrapper exposes the same methods as the wrapped object but adds something on top: logging, caching, retries, validation, rate limiting.
* **Facade** — *simpler* interface over a *complex* subsystem. The wrapper hides several classes behind one entry point and often exposes a curated subset of capability.

A trick to remember: Adapter changes shape, Decorator adds layer, Facade hides complexity.

You can also chain them: a `RetryingLoggingPaymentGatewayAdapter` is a real, sensible thing — Adapter wrapping a Decorator wrapping another Decorator wrapping the SDK.

---

### Q2. Object Adapter vs Class Adapter — which one and why?

**Answer:** Object Adapter every time in TypeScript (and Java, and most modern languages). Class Adapter requires multiple inheritance — you'd inherit from both the Target *and* the Adaptee — which TS doesn't support and most languages don't either.

Even where multiple inheritance is available (C++, Python), Object Adapter is preferred because:

1. **You can adapt classes you don't own.** If the adaptee is in a third-party library, you might not be able to inherit from it cleanly anyway.
2. **You can swap the adaptee at runtime.** With composition, the adapter holds a reference; you can replace it. With inheritance, you're locked.
3. **It works with `final`/sealed classes** that explicitly forbid inheritance.
4. **It composes naturally** with Decorator and other patterns.

So in TS interviews, just say "Object Adapter — composition, not inheritance" and you're set.

---

### Q3. How does Adapter relate to the SOLID principles?

**Answer:** Adapter is the practical embodiment of two SOLID principles:

* **Dependency Inversion (D).** The high-level module (CheckoutController) depends on an abstraction (`PaymentGateway`), not on a concrete (`LegacyPaymentSDK`). The Adapter is what makes that inversion possible — it implements the abstraction in terms of the concrete.
* **Open/Closed (O).** Adding a new payment provider doesn't modify CheckoutController; it adds a new adapter class. The system is open for extension, closed for modification.

It also indirectly supports **Single Responsibility (S)**: the adapter has exactly one job — translate between two interfaces. It doesn't carry business logic.

If you ever see an "adapter" doing currency conversion based on FX rates, applying business discounts, or sending audit events — those are smells. That's not adapter work; either inline simple translations stay, or move complex logic into a service the adapter calls.

---

### Q4. Walk me through how you'd swap Moment.js for Day.js across a codebase using Adapter.

**Answer:** This is a real migration story — Moment was deprecated in 2020 and many codebases still need to migrate.

Step 1 — define a uniform target:

```ts
interface DateUtils {
  format(date: Date, fmt: string): string;
  addDays(date: Date, days: number): Date;
  diffInDays(a: Date, b: Date): number;
  parse(s: string, fmt?: string): Date;
}
```

Step 2 — wrap the *current* library in an adapter (so callers stop using moment directly):

```ts
import moment from "moment";
class MomentAdapter implements DateUtils {
  format(d: Date, fmt: string)        { return moment(d).format(fmt); }
  addDays(d: Date, n: number)         { return moment(d).add(n, "day").toDate(); }
  diffInDays(a: Date, b: Date)        { return moment(a).diff(moment(b), "day"); }
  parse(s: string, fmt?: string)      { return (fmt ? moment(s, fmt) : moment(s)).toDate(); }
}
```

Step 3 — refactor callers to depend on `DateUtils`, not on `moment`. This is mechanical: replace direct `moment(...)` calls with `dateUtils.X(...)`.

Step 4 — write the new adapter:

```ts
import dayjs from "dayjs";
class DayjsAdapter implements DateUtils {
  format(d: Date, fmt: string)        { return dayjs(d).format(fmt); }
  addDays(d: Date, n: number)         { return dayjs(d).add(n, "day").toDate(); }
  diffInDays(a: Date, b: Date)        { return dayjs(a).diff(dayjs(b), "day"); }
  parse(s: string, fmt?: string)      { return (fmt ? dayjs(s, fmt) : dayjs(s)).toDate(); }
}
```

Step 5 — flip the composition root:

```ts
// const dateUtils: DateUtils = new MomentAdapter();
const dateUtils: DateUtils = new DayjsAdapter();
```

Done. Zero caller changes for the actual swap; only the adapter file is new.

The interviewer wants to hear:

1. You introduce the abstraction *before* the swap, so the swap is one-line.
2. You don't try to do everything at once — Adapter lets you migrate incrementally.
3. You mention edge cases: format strings differ slightly between moment and dayjs (moment's `MM` vs dayjs `MM`); some plugins need to be loaded in dayjs (`customParseFormat`). That awareness is the senior signal.

---

### Q5. When is an Adapter NOT the right answer?

**Answer:** A few cases where the pattern misleads more than it helps.

1. **You only have one provider and never plan another.** Wrapping `axios` in an `HttpClient` adapter when you'll only ever use axios is YAGNI. Use it directly. Add the adapter the day a second provider shows up.
2. **The translation is non-trivial business logic.** If your adapter is doing FX conversion, currency lookups, rate-limit handling, retry logic — that's not adapter work. Push it into a domain service; the adapter should stay a thin translator.
3. **The adaptee's API is genuinely better.** Sometimes a library has a beautifully designed API that you want to expose to your callers. Wrapping it in your own bland abstraction is a regression. Use it directly and document why.
4. **The interfaces are fundamentally incompatible.** If the adaptee can't actually do what the target requires (the target says "supports refunds" and the adaptee has no refund concept), an adapter that throws or returns fake values is worse than no adapter — it lies. Either drop that method from the target, or accept that this adaptee doesn't fit.

The mature take: Adapter is one of the most useful patterns, but most overuse comes from premature abstraction. Introduce it at the moment of *real* multiplicity (second provider, deprecated library, test mocks needed), not before.

---

## TL;DR Cheat Sheet

```
Adapter: wrap a class so it fits an interface it didn't natively implement.

Recipe (Object Adapter):
  1. Define Target interface (what your app expects)
  2. Adaptee is the existing class with a different shape
  3. Adapter implements Target, holds an Adaptee, delegates calls
  4. Clients depend only on Target

Use when:
  - integrating a third-party SDK
  - wrapping legacy code you can't change
  - swapping providers without touching callers
  - injecting test fakes

Don't use when:
  - only one provider and no migration in sight
  - the "adapter" would carry real business logic
  - the adaptee already has a great API

vs Decorator: same interface + new behavior (logging, caching)
vs Facade:    simpler interface over a complex subsystem

Real-world: payment gateways, loggers, date libs, HTTP clients,
            ORMs, React Native bridge, Redux middleware, cloud SDKs.

SOLID: enables Dependency Inversion (D) and Open/Closed (O).
```
