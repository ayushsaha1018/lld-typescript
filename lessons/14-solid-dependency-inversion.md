# Lesson 14 — SOLID: D — Dependency Inversion Principle

> **Phase 2 — OOP & SOLID** · *Lesson 6 of 6 — capstone of SOLID*
> The principle that points the arrows of your architecture in the right direction. You've practiced the mechanism (DI in Lesson 08); now we name the principle, and show how all five SOLID rules interlock.

---

## 1. Concept / Theory

### The definition (Robert C. Martin, 1996)

> *"a) High-level modules should not depend on low-level modules. Both should depend on **abstractions**.*
> *b) Abstractions should not depend on details. Details should depend on abstractions."*

Two clauses. Together they describe **which way the dependency arrows in your codebase should point**.

### What "high-level" and "low-level" mean

- **High-level module** — the policy. The business rules. *What* the system does. (`OrderService`, `PaymentFlow`, `BookingPolicy`.)
- **Low-level module** — the mechanism. The plumbing. *How* the system does it. (`PostgresDatabase`, `StripeApiClient`, `SesEmailer`, `RedisCache`.)

The natural assumption — and the trap — is that high-level depends on low-level. After all, `OrderService` *uses* the database, the email service, the payment SDK. So it imports them. Right?

DIP says: **invert that arrow.** The high-level module shouldn't reach down into the low-level mechanism. Both should depend on an **abstraction in the middle**.

### The "inversion" visualized

**Without DIP:**

```
    OrderService
        │
        ▼
   PostgresDatabase      ← OrderService imports the concrete DB class
   StripeApiClient
   SesEmailer
```

The business policy now depends on Postgres specifics, Stripe specifics, SES specifics. Change Postgres to MySQL → edit `OrderService`. The high level is **at the mercy of the low level**.

**With DIP:**

```
    OrderService
        │
        ▼
    [interfaces: Database, PaymentGateway, EmailService]
        ▲
        │
   PostgresDatabase   StripeApiClient   SesEmailer
```

Both `OrderService` and the concrete classes now point inward, toward the **abstraction**. Change Postgres to MySQL → write `MysqlDatabase implements Database`. `OrderService` doesn't move.

The arrow of dependency has been **inverted**: low-level concretions now depend on the abstraction the high-level module defines.

### Where the abstraction lives — the subtle but important rule

The abstraction (`interface Database`) **belongs to the high-level module**, not to the low-level one. Why?

Because the high-level module is the *client* of that interface — it's the one that says "I need something I can `query` and `insert` into." The low-level module is the *supplier* — it conforms to whatever shape the client needs.

This is what makes the inversion *real*. Not just "we have an interface" — but **the interface is defined by the consumer**, not extracted from the supplier. In package layouts:

```
src/
  domain/           ← high-level
    OrderService.ts
    Database.ts            ← interface lives here, alongside its consumer
  infra/            ← low-level
    PostgresDatabase.ts    ← implements domain/Database
    StripeApiClient.ts     ← implements domain/PaymentGateway
```

Compile-time and import-time, `infra/` depends on `domain/`. Never the other way.

> **The phrase to remember:** *"High-level defines the abstraction; low-level implements it."*

### DIP vs DI vs IoC — the trio that interview candidates routinely confuse

| Term | What it is |
|------|------------|
| **DIP** (Dependency Inversion Principle) | The **rule**: depend on abstractions; high-level owns the interface. |
| **DI** (Dependency Injection) | The **mechanism**: hand collaborators in via the constructor (Lesson 08). |
| **IoC** (Inversion of Control) | The **broad concept**: instead of *your code calling the framework*, the framework calls your code. DI is one form of IoC. |

DIP is the principle. DI is the everyday tool you use to satisfy it. IoC is the umbrella term that covers DI, callbacks, event handlers, frameworks like Express/React/NestJS, and more.

If asked: *"is dependency injection the same as the dependency inversion principle?"* — the answer is **no, they're related but distinct**. DI is *how* you implement DIP. DIP says where the interfaces should live and which way the imports should flow.

### Why DIP matters

1. **Stable core, swappable edges.** Your business rules don't break when infrastructure changes (DB swap, payment vendor change, new email provider).
2. **Testability.** The high-level module tests against the interface; you inject fakes — no infrastructure required.
3. **Architectural symmetry.** The dependency diagram makes sense at a glance: arrows point *inward* toward the policy.
4. **Maps directly to common architectures.** Hexagonal (Ports & Adapters), Clean Architecture, and Onion Architecture all use DIP as their cornerstone.

### What DIP is *not*

- **Not "always use an interface for everything."** A pure utility (`StringUtils.slugify`, `Math.clamp`) doesn't need an interface — there's no policy/mechanism split there. DIP applies at **module boundaries** — between business policy and infrastructure.
- **Not "tons of interfaces."** It's one interface per genuine boundary, owned by the consumer.
- **Not "use a DI container."** Containers help wire things up at scale, but DIP is satisfied with plain manual DI. Tooling is optional; the principle is mandatory.

---

## 2. Real-life Analogy

A **book author** is a high-level module. Their *policy* is the story — the plot, the characters, the arc.

The **printer** is a low-level module — paper, ink, presses. The *mechanism* of turning words into a physical book.

In a healthy publishing relationship, the **publisher** defines a *contract* in the middle: manuscript format, page count, paper grade, ISBN. The author writes to that contract. The printer implements it. **Neither party knows the specific other**. The author can change publishers without learning new printing equipment. The printer can change authors without renegotiating physics.

The contract is *defined by the consumer side* (the publisher, on behalf of the author and the reading public), not by the printer. That's why a new printer can step in seamlessly — the contract was already there, waiting.

In bad shape: the author writes the book directly tailored to a specific printer's quirks ("must fit on this exact press"). Now the author can't change printers without rewriting the book. **That's a DIP violation in publishing.**

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — high-level imports concrete low-level

```ts
// ❌ BAD: business policy depends on infrastructure specifics
import { PostgresClient } from "pg";
import Stripe from "stripe";
import SES from "@aws-sdk/client-ses";

class OrderService {
  private db: PostgresClient;
  private stripe: Stripe;
  private ses: SES;

  constructor() {
    this.db = new PostgresClient(process.env.PG_URL!);
    this.stripe = new Stripe(process.env.STRIPE_KEY!);
    this.ses = new SES({ region: "us-east-1" });
  }

  async place(order: OrderInput) {
    const charge = await this.stripe.charges.create({ amount: order.total, currency: "usd" });
    await this.db.query("INSERT INTO orders (id, total, charge_id) VALUES ($1, $2, $3)", [
      order.id, order.total, charge.id,
    ]);
    await this.ses.sendEmail({ /* ... */ });
  }
}
```

**Why it fails:**
- `OrderService` (high-level) imports `pg`, `stripe`, `@aws-sdk/client-ses` (low-level) directly.
- The arrow of dependency points the wrong way: policy depends on plumbing.
- Want to migrate from Postgres to DynamoDB? Edit `OrderService`. Plus every other service that did the same.
- Unit-testable only with real Postgres + real Stripe + real SES, or aggressive monkey-patching.
- The business rules are intertwined with vendor-specific calls (`stripe.charges.create`, `ses.sendEmail`).

### Bad pattern B — interface lives in the wrong place

```ts
// infra/PostgresDatabase.ts — defines its own interface
export interface Database {
  query(sql: string, params: unknown[]): Promise<any>;
}
export class PostgresDatabase implements Database { /* ... */ }

// domain/OrderService.ts — imports Database from infra
import { Database } from "../infra/PostgresDatabase";   // 👀 wrong direction

class OrderService {
  constructor(private readonly db: Database) {}
}
```

This *looks* like DI, but DIP is still broken. The `Database` interface lives in `infra/` — meaning **the domain depends on infrastructure** at the import level. The infrastructure folder is now load-bearing for the business logic. If infra is deleted or renamed, domain compilation breaks.

The fix is moving the interface into `domain/`. Same code, different folder, **the dependency arrow is now correct.**

### Bad pattern C — the abstraction leaks the concretion

```ts
// ❌ BAD: the "interface" exposes vendor-specific shapes
interface PaymentService {
  charge(stripeParams: Stripe.ChargeCreateParams): Promise<Stripe.Charge>;   // 👀 Stripe types in the interface
}
```

The interface has Stripe types in its signatures. That means any class that wants to implement it *must understand Stripe*. The abstraction is fake — it's just a thin wrapper over the concretion. DIP violated.

A real abstraction looks like this:

```ts
interface PaymentService {
  charge(amount: number, currency: string): Promise<{ id: string; status: "ok" | "failed" }>;
}
```

The interface speaks the **domain's language**, not Stripe's. Stripe's `Charge` object is converted to the domain shape inside the adapter. Now Razorpay can implement the same interface.

---

## 4. Good Code (the right way)

The full DIP-compliant `OrderService`, with imports pointed inward.

```ts
// ── domain/Database.ts (high-level owns the abstraction) ──
export interface Database {
  insert(table: string, row: Record<string, unknown>): Promise<unknown>;
  findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null>;
}

// ── domain/PaymentGateway.ts ──
export interface PaymentGateway {
  charge(amount: number, currency: string): Promise<{ id: string; status: "ok" | "failed" }>;
}

// ── domain/EmailService.ts ──
export interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

// ── domain/OrderService.ts (the policy) ──
import { Database } from "./Database";
import { PaymentGateway } from "./PaymentGateway";
import { EmailService } from "./EmailService";

export class OrderService {
  constructor(
    private readonly db: Database,
    private readonly payments: PaymentGateway,
    private readonly emailer: EmailService,
  ) {}

  async place(order: OrderInput) {
    const charge = await this.payments.charge(order.total, "USD");
    if (charge.status !== "ok") throw new Error("payment failed");
    await this.db.insert("orders", { ...order, chargeId: charge.id });
    await this.emailer.send(order.email, "Order confirmed", `Total: ${order.total}`);
  }
}
```

```ts
// ── infra/StripeGateway.ts (low-level adapts to the high-level abstraction) ──
import Stripe from "stripe";
import { PaymentGateway } from "../domain/PaymentGateway";

export class StripeGateway implements PaymentGateway {
  constructor(private readonly stripe: Stripe) {}
  async charge(amount: number, currency: string) {
    const charge = await this.stripe.charges.create({ amount, currency });
    return { id: charge.id, status: charge.status === "succeeded" ? "ok" : "failed" } as const;
  }
}

// ── infra/PostgresDatabase.ts ──
import { Pool } from "pg";
import { Database } from "../domain/Database";

export class PostgresDatabase implements Database {
  constructor(private readonly pool: Pool) {}
  async insert(table: string, row: Record<string, unknown>) {
    /* INSERT with parameterized SQL */
  }
  async findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null> {
    /* SELECT */ return null;
  }
}
```

```ts
// ── main.ts (composition root — the only place that knows the concretes) ──
import { Pool } from "pg";
import Stripe from "stripe";
import { OrderService } from "./domain/OrderService";
import { PostgresDatabase } from "./infra/PostgresDatabase";
import { StripeGateway } from "./infra/StripeGateway";
import { SesEmailService } from "./infra/SesEmailService";

const pool   = new Pool({ connectionString: process.env.PG_URL });
const stripe = new Stripe(process.env.STRIPE_KEY!);

const orders = new OrderService(
  new PostgresDatabase(pool),
  new StripeGateway(stripe),
  new SesEmailService("us-east-1"),
);
```

Walk the imports:
- `domain/OrderService` imports `domain/Database`, `domain/PaymentGateway`, `domain/EmailService`. **All inside domain.**
- `infra/PostgresDatabase` imports `domain/Database`. **Infra depends on domain.**
- `main.ts` imports both, wires them. **The composition root is the only place that knows both worlds.**

Critical observation: **domain has zero imports from infra.** That's the entire DIP test. If you accidentally import `infra/StripeGateway` inside `domain/OrderService`, you've broken DIP — and now your business rules know about Stripe.

> **The DIP smoke test:** can you delete the entire `infra/` folder and have your `domain/` folder still compile? If yes, you have DIP. If no, you don't.

### How DIP enables the architectures you've heard about

```
┌──────────────────────────────────────────┐
│            INFRASTRUCTURE                │
│  ┌─────────────────────────────────┐     │
│  │           DOMAIN                │     │
│  │   ┌─────────────────────┐       │     │
│  │   │     ENTITIES        │       │     │
│  │   │  (Order, User,...)  │       │     │
│  │   └─────────────────────┘       │     │
│  │   uses interfaces it owns       │     │
│  └─────────────────────────────────┘     │
│   adapts to domain's interfaces          │
│   (Postgres, Stripe, SES, Redis, ...)    │
└──────────────────────────────────────────┘
```

This shape is called variously **Hexagonal Architecture (Ports & Adapters)**, **Clean Architecture**, or **Onion Architecture**. All of them rest on DIP. The arrows of dependency always point *inward*, toward the domain. Outer layers know about inner layers; inner layers know nothing about outer layers.

Mature TS / Node codebases — NestJS apps with proper layering, DDD systems, banking systems, fintech platforms — are built on this skeleton. Knowing DIP is the price of admission to discussing architecture.

---

## 5. Real-world Use Cases

- **Database adapters in any ORM-using app.** Domain says `interface UserRepository`; Postgres / DynamoDB / in-memory all implement it. Domain doesn't import the ORM.
- **Payment gateway swap.** Most fintech apps front *every* gateway behind a `PaymentGateway` interface. Adding a new vendor = adding a new adapter; nothing in domain changes.
- **NestJS / Spring / .NET Core.** All three are DI containers built around DIP. Controllers and services depend on tokens (interfaces or abstract classes), and adapters bind to those tokens.
- **Cloud-portable apps.** Dropbox once moved off AWS S3. The migration was tractable because `Storage` was an interface in the domain; the S3 adapter was just one implementation. Without DIP, that move would have been impossible without a rewrite.
- **Test doubles in any well-tested codebase.** Every fast unit test you've ever written satisfies DIP — the system under test depends on an interface, the test injects a fake. The principle is the *engineering rationale* for the entire concept of "unit tests."
- **Plugin systems (VS Code, Webpack, Babel).** The host defines the abstraction; plugins are adapters. The host doesn't import any plugin; plugins import the host's interfaces.
- **Modular monoliths.** A monolith that splits cleanly into modules with DIP at the boundaries can later be carved into microservices with relatively low effort. A monolith without DIP becomes a "distributed monolith" that's worse than the original.

If a senior engineer says "the architecture is healthy", they almost always mean: **the dependency arrows point the right way, and the domain doesn't know about infrastructure.** That's DIP.

---

## 6. Interview Questions (with answers)

### Q1. *"State the Dependency Inversion Principle and explain what's being 'inverted'."*

**Answer.** DIP says high-level modules and low-level modules should both depend on **abstractions**, not on each other; and abstractions should not depend on details — details depend on abstractions. What's "inverted" is the **arrow of dependency**. By default, business code uses infrastructure code, so the policy depends on plumbing. DIP flips that: both depend on a stable abstraction (defined by the policy), and infrastructure adapts to it. The high-level module ends up *not knowing* which concrete infrastructure it's using.

### Q2. *"Is DIP the same as Dependency Injection?"*

**Answer.** No. DIP is the **principle**: design your codebase so the dependency arrows point toward abstractions. DI (Dependency Injection) is **one mechanism** for satisfying DIP — you inject collaborators via the constructor instead of having the class instantiate them. You can have DI without DIP (a class injects a *concrete* `StripeGateway` directly — that's DI, but it violates DIP because the dependency is on a concretion). And DIP without classical DI is conceivable (a dispatch via callbacks or events). Most production code uses both: **DIP defines the goal; DI is the means.**

### Q3. *"In a layered codebase, where does the interface live — domain or infrastructure?"*

**Answer.** **Domain.** The interface belongs to the *consumer* — the high-level module that says "I need something with this shape." The infrastructure layer's job is to implement those interfaces. If the interface lives in `infra/`, the domain has to *import* infra, and DIP collapses. The smoke test: can you delete `infra/` and still compile `domain/`? If yes, DIP holds.

### Q4. *"Refactor this `OrderService` to comply with DIP."*
```ts
import { PostgresClient } from "pg";

class OrderService {
  private db = new PostgresClient(process.env.PG_URL!);
  async place(order: OrderInput) {
    await this.db.query("INSERT INTO orders ...", [...]);
  }
}
```

**Answer.** Three steps:

1. Define a domain-owned interface that speaks the domain's language.
   ```ts
   // domain/Database.ts
   interface Database {
     insertOrder(o: OrderInput): Promise<{ id: string }>;
   }
   ```
2. Make `OrderService` depend on the interface, not on `pg`.
   ```ts
   class OrderService {
     constructor(private readonly db: Database) {}
     async place(order: OrderInput) { await this.db.insertOrder(order); }
   }
   ```
3. Implement the interface in the infra layer.
   ```ts
   class PostgresDatabase implements Database {
     constructor(private readonly client: PostgresClient) {}
     async insertOrder(o: OrderInput) { /* parameterized SQL */ return { id: o.id }; }
   }
   ```
4. Wire it in the composition root: `new OrderService(new PostgresDatabase(...))`.

Now `OrderService` doesn't import `pg`, doesn't know about Postgres, can be tested with a fake `Database`, and Postgres can be swapped for DynamoDB by changing one line in `main.ts`.

### Q5. *"What's 'depending on a concretion' and why does it break DIP even if you're using DI?"*

**Answer.** Depending on a concretion means the constructor parameter is typed as a **specific class**, not an interface:

```ts
// 👀 still DIP-violating despite using DI
class OrderService {
  constructor(private readonly stripe: StripeGateway) {}   // concrete class
}
```

The class is still tightly coupled to Stripe. You can't pass Razorpay. You can't pass a fake. DI mechanics don't help because the type system is still pointing the dependency arrow at a concretion. The fix is one keyword: type the parameter as `PaymentGateway` (the interface), and now anything implementing it works.

### Q6. *"How do all five SOLID principles fit together?"*

**Answer.** They reinforce each other:

- **SRP** — each class has one reason to change. (Small, focused units.)
- **OCP** — add new behavior by writing new classes, not editing old ones. (Polymorphism + abstractions.)
- **LSP** — subclasses must honor the parent's behavioral contract. (The correctness guarantee for OCP.)
- **ISP** — interfaces should be role-based, not catch-all. (Prevents LSP violations from existing.)
- **DIP** — high-level depends on abstractions, not concretions. (The architectural shape that lets the others scale.)

In sequence: **SRP** keeps classes small. **ISP** keeps their interfaces small. **LSP** keeps subclasses honest. **OCP** uses those clean interfaces and honest subclasses to allow extension without modification. **DIP** is the structural rule that makes the whole edifice possible — by pointing dependencies at abstractions you control.

The mental model: SOLID is **one principle, expressed five ways**: *minimize the cost of change*. Each principle attacks a different angle of that goal.

### Q7. *"What architectures or patterns rest on DIP?"*

**Answer.** A short list:

- **Hexagonal Architecture (Ports & Adapters)** — the interface is the "port"; the adapter is the implementation. DIP is its foundational rule.
- **Clean Architecture** — domain at the center; layers point inward.
- **Onion Architecture** — same as Clean, slightly different vocabulary.
- **Dependency Injection containers** (NestJS, Spring, .NET Core) — automate DIP-compliant wiring.
- **Strategy / Adapter / Repository / Gateway** patterns — each is a focused application of DIP.
- **Plugin systems** — host defines abstraction; plugins implement.
- **Test pyramids** — fast unit tests are a *consequence* of DIP, not just a happy accident.

If an architecture description mentions any of these, DIP is in the room.

### Q8 (bonus). *"What's the limit of DIP — when shouldn't I extract an interface?"*

**Answer.** Three honest limits:

1. **For pure utilities** (`StringUtils.slugify`, `mathClamp`) — there's no policy / mechanism split, no boundary worth abstracting. Just a function.
2. **For one-off code paths** with no future variants — premature abstraction adds cost without benefit. Wait until a second implementation is plausible.
3. **Inside a small, cohesive module** — DIP applies at *module / layer* boundaries. Internal classes within one module don't need full DIP between them; they can directly depend on each other when there's no separate axis of change.

The senior engineer's calibration: **apply DIP rigorously at boundaries between business and infrastructure (DB, HTTP, FS, time, randomness, third-party SDKs), and lightly elsewhere.** Boundaries are where evolution happens; the rest is implementation detail.

---

## Recap — what to remember

1. **DIP — high-level depends on abstractions; low-level adapts to them.** The arrow of dependency points inward.
2. **The abstraction belongs to the high-level module**, not the low-level one. That's what makes the inversion real.
3. **DIP smoke test:** can you delete `infra/` and still compile `domain/`? If yes, DIP holds.
4. **DIP ≠ DI.** DIP is the principle; DI is one mechanism that satisfies it.
5. The **abstraction must speak the domain's language**, not the vendor's. Stripe's `Charge` shape leaking into your interface is DIP violated.
6. **DIP is the architectural skeleton** of Hexagonal, Clean, and Onion architectures.
7. SOLID together is **one idea expressed five ways: minimize the cost of change.**

---

# 🎉 Phase 2 complete

You've finished the OOP & SOLID phase. Recap:

| # | Topic | Key takeaway |
|---|-------|--------------|
| 09 | Four Pillars of OOP | Encapsulation hides state; Abstraction hides complexity. Polymorphism is the engine. |
| 10 | SOLID — S (SRP) | One reason to change. Apply the "and" test. |
| 11 | SOLID — O (OCP) | Open for extension, closed for modification. Polymorphism + the right abstraction. |
| 12 | SOLID — L (LSP) | Subclasses must substitute without surprising the caller. Behavior > nominal "is-a". |
| 13 | SOLID — I (ISP) | Role-based interfaces. Don't force clients to depend on methods they don't use. |
| 14 | SOLID — D (DIP) | High-level owns the abstraction; low-level adapts. Domain doesn't import infra. |

You've now mastered the **language**, the **pillars**, and the **principles** of OO design. The next phases use these as building blocks.

## What's next — Phase 3: UML & Design Basics

A short, practical phase: **how to read and draw enough UML to think in pictures** during interviews. Class diagrams, associations, aggregation, composition, dependency. We won't go full-academic — just enough to translate requirements into entities and relationships in a whiteboard interview.

After Phase 3 — **Phase 4: Design Patterns** — the meaty section. You've already met Strategy, Template Method, Repository, and Chain of Responsibility informally; we'll formalize them and the rest of the GoF catalog.

When you're ready, say **"next"** to begin Phase 3.
