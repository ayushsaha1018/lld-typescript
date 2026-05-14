# Lesson 06 — Static Members & Enums

> **Phase 1 — TypeScript for LLD**
> Two small features that interview candidates routinely misuse. Get them right and your code will read like a senior engineer wrote it.

---

# Part A — Static Members

## 1. Concept / Theory

A **static member** belongs to the **class itself**, not to any individual instance.

```ts
class MathUtils {
  static readonly PI = 3.14159;

  static circleArea(r: number): number {
    return MathUtils.PI * r * r;
  }
}

MathUtils.circleArea(5);     // ✅ called on the class
new MathUtils().circleArea;  // ❌ instance doesn't have it
```

Two flavors:
- **Static field** — a shared value (`MathUtils.PI`).
- **Static method** — a function that doesn't need an instance (`MathUtils.circleArea`).

### When statics make sense

1. **Pure utility functions** that have no per-instance state.
   ```ts
   class StringUtils {
     static slugify(s: string) { return s.toLowerCase().replace(/\s+/g, "-"); }
   }
   ```
2. **Constants** that belong conceptually with a class.
   ```ts
   class HttpClient {
     static readonly DEFAULT_TIMEOUT = 5000;
   }
   ```
3. **Static factory methods** — alternative ways to construct an object, often with named intent.
   ```ts
   class Money {
     private constructor(public readonly amount: number, public readonly currency: string) {}
     static rupees(amount: number) { return new Money(amount, "INR"); }
     static dollars(amount: number) { return new Money(amount, "USD"); }
   }
   const fee = Money.rupees(499);
   ```
4. **Counters / class-level bookkeeping** that genuinely belong to the *class*, not an instance.
   ```ts
   class User {
     private static nextId = 1;
     readonly id = User.nextId++;
   }
   ```

### When statics become an antipattern

- **Static = global mutable state.** Two parts of your app touching the same static field are *coupled invisibly*. This breaks tests (one test pollutes the next), parallelism, and reasoning.
- **Static methods that "do work"** (DB queries, network calls) are **untestable** — you can't substitute a mock without monkey-patching.
- **Sprawling utility classes** (`Helpers.do_everything()`) are a bag of tricks where nothing has a real owner. Often a sign you needed a class with proper instances + DI.

> **Rule of thumb:** statics are great for *pure, stateless, side-effect-free* helpers and for *factory methods* that construct instances. Anywhere else, prefer real instances with composition.

### Statics are NOT polymorphic

Static methods can be inherited but **cannot be overridden** at runtime in any useful way. Polymorphic dispatch in JS happens through the prototype chain, which is per-instance. If you need polymorphism (Lesson 03), use instance methods.

```ts
class Base { static greet() { return "Hello"; } }
class Child extends Base { static greet() { return "Hi"; } }

function shoutFrom(cls: typeof Base) { return cls.greet(); }
shoutFrom(Child);   // returns "Hi" but only because we passed the class itself,
                    // not because of polymorphism. There's no runtime dispatch.
```

---

## 2. Real-life Analogy

A class with statics is like a **company HQ**.

- `Apple.foundedYear = 1976` — this is a fact about *Apple Inc.*, not about your individual iPhone.
- `Apple.releaseProduct(name)` — a corporate-level action; no specific iPhone "performs" it.
- An *iPhone* (instance) has its own `serialNumber`, `battery`, `owner`. Those are instance fields.

Mixing them up — putting `serialNumber` on the company, or `releaseProduct` on a phone — is exactly the kind of error junior code makes.

---

## 3. Bad Code (statics, what NOT to do)

```ts
// ❌ BAD: a "service" class made entirely of statics
class UserService {
  static users: User[] = [];

  static createUser(name: string): User {
    const u = { id: UserService.users.length + 1, name };
    UserService.users.push(u);
    return u;
  }

  static findUser(id: number): User | undefined {
    return UserService.users.find(u => u.id === id);
  }
}

UserService.createUser("Ayush");
```

**Why it fails:**
1. `UserService.users` is **shared global state**. Every test that calls `createUser` leaves residue for the next.
2. `UserService.findUser` cannot be mocked or replaced. You're stuck with this implementation forever.
3. There's no way to have *two* `UserService`s — say, one with a real DB and one with a fake.
4. Dependencies (a database, a logger) are hidden inside the static methods. Composition would make them explicit.

---

## 4. Good Code (statics, the right way)

```ts
// ✅ GOOD: real class, real instance, dependencies injected
class UserService {
  constructor(private readonly db: Database) {}

  async createUser(name: string): Promise<User> {
    return this.db.insert("users", { name });
  }

  async findUser(id: string): Promise<User | undefined> {
    return this.db.findOne("users", { id });
  }
}

// statics reserved for things that genuinely have no instance
class UserId {
  private constructor(public readonly value: string) {}

  static newRandom(): UserId {
    return new UserId(crypto.randomUUID());
  }

  static fromString(raw: string): UserId {
    if (!raw.match(/^[0-9a-f-]{36}$/)) throw new Error("invalid uuid");
    return new UserId(raw);
  }
}
```

What changed:
- Behavior with state lives in **instances**, with collaborators injected (composition — Lesson 04).
- Statics are reserved for **pure factories** (`UserId.newRandom`, `UserId.fromString`) — they create instances, nothing else.
- The class is now testable with a mock database. Two services with different databases is trivial.

---

# Part B — Enums

## 1. Concept / Theory

Enums let you express "this value is one of a small fixed set."

```ts
enum OrderStatus {
  Created = "CREATED",
  Paid = "PAID",
  Shipped = "SHIPPED",
  Cancelled = "CANCELLED",
}

function ship(status: OrderStatus) {
  if (status !== OrderStatus.Paid) throw new Error("cannot ship unpaid order");
}
```

There are three TS approaches to this:

### 1. Numeric enum (TS default)
```ts
enum Color { Red, Green, Blue }   // 0, 1, 2 under the hood
```

### 2. String enum
```ts
enum Color { Red = "RED", Green = "GREEN", Blue = "BLUE" }
```

### 3. Union of string literals (no `enum` keyword)
```ts
type Color = "RED" | "GREEN" | "BLUE";
```

### 4. `as const` object (the "modern" replacement)
```ts
const Color = {
  Red:   "RED",
  Green: "GREEN",
  Blue:  "BLUE",
} as const;

type Color = typeof Color[keyof typeof Color];  // "RED" | "GREEN" | "BLUE"
```

### Why the debate matters

In 2026 the community has largely moved away from `enum` in TypeScript for **three reasons**:

1. **Numeric enums are unsafe.** A numeric enum value lets *any* number through:
   ```ts
   enum Color { Red, Green, Blue }
   const c: Color = 999;   // ✅ no error — but obviously broken
   ```
2. **`enum` emits real JS.** Every enum compiles to an object at runtime, which means **bigger bundles**. String literal unions and `as const` objects compile to nothing extra (the union vanishes; the const object is just one object).
3. **Enums don't tree-shake.** Even an unused enum value can survive into the bundle. Const-object + union always tree-shakes cleanly.

The Effective TypeScript book, the TS handbook, and major frameworks now recommend:

> **Use string-literal unions or `as const` objects. Reach for `enum` only if you specifically need an enum's bidirectional reverse-mapping or you're stuck on legacy code.**

This is a real, common interview question. Be ready.

### `as const` objects — the recommended pattern in detail

```ts
const HttpStatus = {
  Ok: 200,
  Created: 201,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
  ServerError: 500,
} as const;

type HttpStatus = typeof HttpStatus[keyof typeof HttpStatus];   // 200 | 201 | 400 | ...

function respond(code: HttpStatus) { /* ... */ }

respond(HttpStatus.Ok);   // ✅
respond(404);             // ✅ — also valid because 404 is in the union
respond(999);             // ❌
```

You get:
- A namespace-like grouping (`HttpStatus.Ok`).
- A precise union type for the values.
- No runtime enum object beyond the const itself.
- Easy iteration (`Object.values(HttpStatus)`).

---

## 2. Real-life Analogy

An enum is the **drop-down menu of valid choices**. Imagine a form for "Order Status" — the user can only pick from `CREATED / PAID / SHIPPED / CANCELLED`. They can't type "TELEPORTED". That's the constraint enums enforce in code.

A `string` typed field is a **free-text box**. Anything goes — including typos. `"shippped"`, `"shipping"`, `"ship"`. You just lost type safety.

A `number` typed field as status is a **lottery ticket**. `42`? `-3`? `0.5`? All valid. None meaningful.

---

## 3. Bad Code (enums, what NOT to do)

### Bad pattern A — magic strings everywhere

```ts
// ❌ BAD: every state machine uses raw strings
function transition(order: Order, action: string) {
  if (action === "pay") order.status = "paid";
  if (action === "ship") order.status = "shippped";   // typo, compiles fine 😬
}

if (order.status === "PAID") { /* never matches — case mismatch */ }
```

There's no compiler help. Typos and case mismatches go straight to production.

### Bad pattern B — numeric enums for things that aren't numbers

```ts
// ❌ BAD: order status as a numeric enum
enum OrderStatus { Created, Paid, Shipped, Cancelled }
const o: OrderStatus = -1;        // valid! 😱
console.log(JSON.stringify(o));   // 0 — useless in logs
```

Numeric enums leak meaningless integers into your logs, JSON payloads, and DBs. When status changes from 1 to 2 in the DB, future-you has no idea what that means.

### Bad pattern C — using `enum` when a const object would do

```ts
enum Permission {
  Read = "READ",
  Write = "WRITE",
  Admin = "ADMIN",
}
```

Looks fine, but it ships an extra runtime object, doesn't tree-shake, and the only thing you gain is `Permission.Read`-style access — which `as const` gives you for free with smaller output.

---

## 4. Good Code (enums, the right way)

### Recommended: string-literal union or `as const` object

```ts
// Option 1 — string-literal union, simplest
type OrderStatus = "CREATED" | "PAID" | "SHIPPED" | "CANCELLED";

function ship(o: { status: OrderStatus }) {
  if (o.status !== "PAID") throw new Error("not yet paid");
}

ship({ status: "PAID" });        // ✅
ship({ status: "shippped" });    // ❌ caught at compile time
```

```ts
// Option 2 — as-const object, when you want a "namespace"
const OrderStatus = {
  Created:   "CREATED",
  Paid:      "PAID",
  Shipped:   "SHIPPED",
  Cancelled: "CANCELLED",
} as const;

type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

function ship(o: { status: OrderStatus }) {
  if (o.status !== OrderStatus.Paid) throw new Error("not yet paid");
}

ship({ status: OrderStatus.Paid });    // ✅
```

The const-object form is preferable when:
- You want to iterate the values: `Object.values(OrderStatus).forEach(...)`.
- You want named keys for readability in code, not just literals scattered around.
- You're migrating off an enum — this is the smoothest replacement.

### Real example — discriminated union of states

This is gold for state-machine modeling, which interviews love.

```ts
type Order =
  | { status: "CREATED";   id: string }
  | { status: "PAID";      id: string; paidAt: Date }
  | { status: "SHIPPED";   id: string; trackingId: string }
  | { status: "CANCELLED"; id: string; reason: string };

function describe(o: Order) {
  switch (o.status) {
    case "CREATED":   return `Order ${o.id} just created`;
    case "PAID":      return `Order ${o.id} paid at ${o.paidAt}`;
    case "SHIPPED":   return `Order ${o.id} on the way: ${o.trackingId}`;
    case "CANCELLED": return `Order ${o.id} cancelled: ${o.reason}`;
  }
}
```

Each status carries the **data that makes sense in that state**. TS narrows automatically inside each `case`. Adding a new status forces `describe` to handle it (with a `never`-check for exhaustiveness — see Q4 in interview questions).

---

## 5. Real-world Use Cases

- **HTTP status codes** — every framework now uses an `as const` object or string-literal union. Express, NestJS, and AWS SDK have all moved.
- **Action types in Redux Toolkit** — `as const` strings (`"todos/added"`) over enums.
- **Feature flags** — `type Flag = "DARK_MODE" | "BETA_DASHBOARD"`.
- **State machines** — discriminated unions are the *idiomatic* TS way to model `Order`, `Booking`, `Payment` states.
- **OpenAPI / GraphQL codegen** — both default to string unions, not enums.
- **AWS CDK and React Native** type defs — all string-literal unions in their modern revisions.

You'll occasionally see enums in older Angular code, NestJS DTOs, and projects that pre-date TS 4. They still *work* — but you're picking a heavier tool.

---

## 6. Interview Questions (with answers)

### Q1. *"Why do many TypeScript teams avoid `enum`?"*

**Answer.** Three reasons:
1. Numeric enums are unsafe — any number passes the type check, defeating the purpose.
2. `enum` produces runtime code (an object), which adds to bundle size and survives tree-shaking poorly.
3. String-literal unions and `as const` objects give the same expressive power with **zero runtime overhead** and stricter compile-time safety.

If asked which to recommend: **string-literal unions for simple cases, `as const` objects when you need a namespace + iteration**.

### Q2. *"What's a discriminated union and why is it a powerful pattern?"*

**Answer.** A union of object types where each member has a common literal field (the **discriminator**) that tells TS which variant you have:

```ts
type Shape =
  | { kind: "circle";  radius: number }
  | { kind: "square";  side: number }
  | { kind: "triangle"; base: number; height: number };

function area(s: Shape) {
  switch (s.kind) {
    case "circle":   return Math.PI * s.radius ** 2;
    case "square":   return s.side * s.side;
    case "triangle": return 0.5 * s.base * s.height;
  }
}
```

TS narrows `s` inside each case to the right variant — `s.radius` only exists where `s.kind === "circle"`. This is the modern, type-safe alternative to `if/else` chains, and it's how mature TS codebases model entities with multiple states.

### Q3. *"What's a static factory method? When would you choose it over a constructor?"*

**Answer.** A static method on the class that returns an instance, often with **named intent**:

```ts
class Money {
  private constructor(public amount: number, public currency: string) {}
  static rupees(amount: number) { return new Money(amount, "INR"); }
  static dollars(amount: number) { return new Money(amount, "USD"); }
  static fromCents(cents: number, currency: string) {
    return new Money(cents / 100, currency);
  }
}
```

You'd choose it over a constructor when:
- You want **named** alternative constructions (`fromJson`, `fromString`, `withDefaults`).
- You want to **return a cached instance** instead of always allocating (Singleton-like behavior).
- You want to **return a subclass** based on input.
- You want to *guard* construction by hiding the actual constructor — `private constructor` + public statics.

### Q4. *"What's exhaustiveness checking and how do you do it in TS?"*

**Answer.** Make sure a `switch` covers every variant of a union. The trick is the `never` type:

```ts
type Status = "CREATED" | "PAID" | "SHIPPED" | "CANCELLED";

function describe(s: Status): string {
  switch (s) {
    case "CREATED":   return "...";
    case "PAID":      return "...";
    case "SHIPPED":   return "...";
    case "CANCELLED": return "...";
    default: {
      const _exhaustive: never = s;   // 🛡️ if a new status is added, this errors
      throw new Error(`unhandled: ${_exhaustive}`);
    }
  }
}
```

If someone later adds `"REFUNDED"` to `Status`, the assignment to `never` fails to compile — TS guides you to the missing case. **Adopt this idiom for every state machine.** It's one of the highest-leverage habits in a TS codebase.

### Q5. *"When *would* you still use a `static` field or method?"*

**Answer.**
- **Pure helpers** with no state: `Logger.formatTimestamp()`, `MathUtils.clamp(n, min, max)`.
- **Constants** that conceptually belong to a class: `HttpClient.DEFAULT_TIMEOUT`.
- **Factory methods** for alternative constructions: `Money.fromCents(...)`.
- **Class-wide counters or registries**, when the bookkeeping really is per-class (use sparingly).

**Avoid** statics for anything stateful or anything with dependencies on a database, network, or filesystem. Those want instances + DI.

### Q6. *"What's the relationship between statics and Singletons?"*

**Answer.** A class with only static members and no instance state **is** a poor-man's Singleton — there's only ever "one" of it because there's no constructor to call. The difference:

- A *Singleton class* has a private constructor and a `getInstance()` static method that returns one cached instance.
- A *fully static class* has no instance at all.

Both share the same drawback: **global state, hidden dependencies, hard to test**. The Singleton pattern (which we'll cover in Phase 4 — Creational Patterns) is rarely the right answer in modern code; injection containers solve "I need exactly one of this" better.

---

## Recap — what to remember

1. A **static member** belongs to the class, not an instance. Best uses: pure helpers, constants, factories.
2. Avoid statics for anything **stateful** or **dependency-having** — that's hidden global state and untestable.
3. **Default to string-literal unions** or **`as const` objects** instead of `enum`.
4. **Discriminated unions** are the idiomatic TS way to model state machines — pair with exhaustiveness checks via `never`.
5. **Static factory methods** (`Money.rupees(499)`) are a clean alternative to constructors when you want named intent.
6. If you find yourself writing a class of only statics, ask whether it should be an instance with injected collaborators.

---

## What's next
Lesson 07 — **Utility Types**: `Partial<T>`, `Pick<T>`, `Omit<T>`, `Record<K, V>`, `Readonly<T>`, `Required<T>`. The toolbox you'll use in every DTO and domain model.
