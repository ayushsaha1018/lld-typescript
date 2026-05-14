# Lesson 08 — Dependency Injection Basics

> **Phase 1 — TypeScript for LLD** · *Final lesson*
> The pattern that ties together interfaces, composition, and generics into code that's testable, swappable, and ready for any LLD interview.

---

## 1. Concept / Theory

### The one-line definition

**Dependency Injection (DI)** is the practice of giving an object the things it needs to do its job, instead of letting it create them itself.

The opposite — *creating your own dependencies inside the class* — is called **dependency lookup** or **tight coupling**.

```ts
// ❌ NOT DI — class creates its own dependency
class UserService {
  private db = new PostgresDatabase();   // hard-coded
  private logger = new ConsoleLogger();  // hard-coded
}

// ✅ DI — dependencies are HANDED IN
class UserService {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}
}
```

The second class doesn't know what `Database` it got. Could be Postgres in production, in-memory in tests, MySQL after a migration. **It doesn't care.** That's the win.

### Three flavors of DI (in the academic literature)

1. **Constructor injection** — dependencies handed in via the constructor. **This is the one you'll use 95% of the time.**
2. **Setter injection** — dependencies handed in via setter methods after construction.
3. **Interface injection** — the class implements an interface that the framework calls to inject dependencies.

For LLD interviews, **constructor injection is the answer** unless asked about a specific framework. It's the simplest, the most explicit, and the easiest to reason about.

### What gets injected — depend on **interfaces**, not concretions

This is the rule that gives DI its power. Look at the constructor:

```ts
constructor(private readonly db: Database) {}
//                          ^^^^^^^^
//                          interface, not PostgresDatabase
```

The class accepts *any* `Database`. In production you pass `new PostgresDatabase()`. In tests you pass `{ query: async () => fakeRows }`. The class is one piece of code; its collaborators can be anything that satisfies the contract. This is the **Dependency Inversion Principle** (the D in SOLID — Phase 2 next), and DI is how you implement it day to day.

### Manual DI vs framework DI

You don't need a framework to do DI. Manual DI is just *new-ing things up* in the right order:

```ts
const db       = new PostgresDatabase(connectionString);
const logger   = new FileLogger("/var/log/app.log");
const userRepo = new UserRepository(db);
const service  = new UserService(userRepo, logger);
```

This bottom-up wiring lives in one place — usually `main.ts` or `index.ts` — called the **composition root**. Everything below it just receives what it needs.

A DI framework (NestJS, InversifyJS, tsyringe, Spring in Java) automates this wiring with **decorators and a container**:

```ts
@Injectable()
class UserService {
  constructor(private readonly db: Database, private readonly logger: Logger) {}
}
// container resolves and wires it for you
```

For LLD interviews, **always reach for manual DI first**. If asked about NestJS or Inversify, mention the container pattern as an *automation* of the same idea.

### Why DI matters

| Without DI | With DI |
|-----------|---------|
| Class hard-codes its dependencies | Class declares its dependencies |
| Cannot test in isolation — need real DB, real network | Pass mocks in the constructor |
| Swapping a dependency means editing the class | Swap a dependency by passing a different instance |
| Dependencies hidden inside `new` calls | Dependencies visible in the constructor signature |
| Tightly coupled to specific implementations | Coupled only to interfaces |

---

## 2. Real-life Analogy

A **chef** at a restaurant.

- **Tight coupling (no DI):** the chef walks out to the farm to grow vegetables, milks the cow for cheese, and forges their own knives. Then cooks. Result: the kitchen can never run without that chef *literally doing everything*. Replace the chef and the whole restaurant collapses.
- **Dependency injection:** vegetables arrive from a supplier. Cheese arrives from another. Knives are provided by the kitchen. The chef just **cooks** — and assumes that whatever shows up matches the contract ("a head of cabbage, a knife sharp enough to chop it"). Tomorrow the supplier changes — the chef doesn't notice. Tomorrow you want to test a recipe — you supply *fake* ingredients (sponges shaped like vegetables) and watch what the chef does.

DI is the supply chain. Without it, every class becomes a self-contained farm that cannot be tested or swapped.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — `new`ing dependencies inside the class

```ts
// ❌ BAD: hard-coded everything
class OrderService {
  async placeOrder(input: OrderInput) {
    const db = new PostgresDatabase();              // hard-coded
    const payment = new StripePaymentGateway();     // hard-coded
    const emailer = new SesEmailService();          // hard-coded
    const logger = new ConsoleLogger();             // hard-coded

    logger.info("placing order");
    const charge = await payment.charge(input.total);
    const order = await db.insert("orders", { ...input, chargeId: charge.id });
    await emailer.send(input.email, "Order placed!");
    return order;
  }
}
```

**Why it fails:**
1. **Untestable.** Can't run unit tests without a real Postgres, real Stripe, real SES.
2. **Unswappable.** Want to use Razorpay instead of Stripe? Edit `OrderService` (and every other place that did `new StripePaymentGateway()`).
3. **Single responsibility violated.** `OrderService` is now responsible for both *placing orders* AND *bootstrapping its world*.
4. **Hidden dependencies.** The constructor signature says "I need nothing" — but the class actually needs four collaborators. A new developer reading the constructor has no idea.

### Bad pattern B — Service Locator antipattern

```ts
// ❌ BAD: pulling dependencies from a global "registry"
const registry = {
  db: new PostgresDatabase(),
  payment: new StripePaymentGateway(),
};

class OrderService {
  async placeOrder(input: OrderInput) {
    const charge = await registry.payment.charge(input.total);  // 👀
    const order = await registry.db.insert("orders", input);
    return order;
  }
}
```

This *looks* like DI (no `new`!), but it's not — it's a **service locator**, and it has the same drawbacks as static methods:

- The class still knows about the global registry. Same hidden coupling, just disguised.
- You can't tell from the constructor what this class needs.
- Two unrelated tests share the registry — order matters; one test pollutes the next.

> **Constructor injection > service locator.** Always.

### Bad pattern C — depending on a concrete class

```ts
// ❌ BAD: depends on the concrete StripeGateway, not an abstraction
class OrderService {
  constructor(private readonly stripe: StripeGateway) {}  // 👀 concrete
}
```

DI by mechanics, but the type is `StripeGateway` not `PaymentGateway`. So you can never pass Razorpay or a mock without changing this class. The whole point of DI is **swappability** — and swappability requires the dependency type to be an **interface**.

---

## 4. Good Code (the right way)

### Constructor injection done right

```ts
// ── Interfaces (contracts) ────────────────────
interface Database {
  insert(table: string, row: Record<string, unknown>): Promise<unknown>;
  findOne<T>(table: string, where: Record<string, unknown>): Promise<T | null>;
}

interface PaymentGateway {
  charge(amount: number): Promise<{ id: string; status: "ok" | "failed" }>;
}

interface EmailService {
  send(to: string, body: string): Promise<void>;
}

interface Logger {
  info(msg: string): void;
  error(msg: string, err?: unknown): void;
}

// ── The service depends on interfaces ────────────────────
class OrderService {
  constructor(
    private readonly db: Database,
    private readonly payment: PaymentGateway,
    private readonly emailer: EmailService,
    private readonly logger: Logger,
  ) {}

  async placeOrder(input: OrderInput) {
    this.logger.info(`placing order for ${input.email}`);
    const charge = await this.payment.charge(input.total);
    if (charge.status !== "ok") {
      this.logger.error("charge failed");
      throw new Error("payment failed");
    }
    const order = await this.db.insert("orders", { ...input, chargeId: charge.id });
    await this.emailer.send(input.email, "Order placed!");
    return order;
  }
}

// ── Composition root (main.ts) ────────────────────
const db: Database          = new PostgresDatabase(process.env.DB_URL!);
const payment: PaymentGateway = new StripeGateway(process.env.STRIPE_KEY!);
const emailer: EmailService = new SesEmailer(process.env.AWS_REGION!);
const logger: Logger        = new FileLogger("/var/log/app.log");

const orderService = new OrderService(db, payment, emailer, logger);
```

What this delivers:

- The `OrderService` source has zero `new` calls — it's pure business logic.
- Want to swap Stripe for Razorpay? Change one line in `main.ts`.
- Constructor signature is the **public contract** — you can read it and immediately know what `OrderService` needs.
- Logger, payment, db are all **interfaces**, so concrete implementations can change without touching `OrderService`.

### The same class, in a unit test — trivial

```ts
test("placeOrder triggers email on success", async () => {
  // arrange — fake collaborators
  const db: Database = {
    insert: async () => ({ id: "o1" }),
    findOne: async () => null,
  };
  const payment: PaymentGateway = {
    charge: async () => ({ id: "ch_1", status: "ok" }),
  };
  const sendCalls: { to: string; body: string }[] = [];
  const emailer: EmailService = {
    send: async (to, body) => { sendCalls.push({ to, body }); },
  };
  const logger: Logger = { info: () => {}, error: () => {} };

  const svc = new OrderService(db, payment, emailer, logger);

  // act
  await svc.placeOrder({ email: "u@x.com", total: 499 });

  // assert
  expect(sendCalls).toHaveLength(1);
  expect(sendCalls[0].to).toBe("u@x.com");
});
```

No mocks library. No monkey-patching. No environment setup. Just plain object literals matching the interfaces. **This is the entire reason DI matters.**

### A note on framework DI (NestJS-style — for completeness)

```ts
// What NestJS does for you, conceptually:
@Injectable()
class OrderService {
  constructor(
    @Inject("Database") private readonly db: Database,
    @Inject("PaymentGateway") private readonly payment: PaymentGateway,
  ) {}
}

// somewhere in module config
@Module({
  providers: [
    { provide: "Database", useClass: PostgresDatabase },
    { provide: "PaymentGateway", useClass: StripeGateway },
    OrderService,
  ],
})
class AppModule {}
```

Same idea — the framework wires up the composition root for you. For LLD interviews, you don't usually need this; manual DI shows the principle without the framework noise.

### Tying it back to past lessons

- **Lesson 02 (Interfaces / Abstract Classes):** the `Database`, `PaymentGateway`, `EmailService`, `Logger` types here are interfaces. Without them, DI couldn't decouple.
- **Lesson 03 (Polymorphism):** `OrderService` doesn't know which `PaymentGateway` it got — runtime dispatch handles it.
- **Lesson 04 (Composition):** `OrderService` *has-a* logger, *has-a* payment gateway. It's the textbook composition pattern.
- **Lesson 05 (Generics):** the same `Repository<T>` pattern composes via DI: `new UserService(new Repository<User>())`.
- **Lesson 06 (Statics vs instances):** DI is the answer to "should this be static?" — no, make it an instance and inject what it needs.

DI is the **glue** that makes the rest of Phase 1 actually work in production code.

---

## 5. Real-world Use Cases

- **NestJS** — built end-to-end on constructor DI. Every controller, service, guard, interceptor receives its collaborators via the constructor.
- **Angular** — same model. Services injected via constructor params.
- **Spring (Java)** and **.NET Core (C#)** — the same pattern; both have battle-tested DI containers.
- **Express + manual DI** — many production Node apps wire things up by hand in `app.ts`. Clean, simple, no magic.
- **InversifyJS / tsyringe / typedi** — popular standalone DI containers for plain TS / Node.
- **Test setup in *every* TS codebase that has decent unit tests** — the test files instantiate the class with mock collaborators. If you can't do that easily, your code wasn't using DI.

---

## 6. Interview Questions (with answers)

### Q1. *"What is dependency injection, and why does it matter?"*

**Answer.** DI is the practice of supplying a class's collaborators from outside (typically via the constructor) instead of letting the class create them. It matters for three reasons:

1. **Testability.** You can pass mocks in unit tests without monkey-patching or running real infrastructure.
2. **Swappability.** You can change implementations (Postgres → MySQL, Stripe → Razorpay, console logger → file logger) without touching the class.
3. **Explicit contracts.** The constructor signature documents exactly what the class needs.

The deeper principle is **dependency inversion** — *depend on abstractions, not concretions* — which DI implements.

### Q2. *"What's the difference between dependency injection and a service locator? Why prefer DI?"*

**Answer.**
- **DI** — collaborators are *given to* the class via its constructor (or setter). The class declares what it needs in its own signature.
- **Service Locator** — the class fetches its collaborators from a global registry (`registry.get("Database")`).

Both achieve indirection, but the service locator hides what the class needs — you have to read the body of every method to find out which dependencies are pulled. With DI, the constructor *is* the dependency manifest. Service locators also share the global-state pitfalls of statics: tests pollute each other; parallelism breaks. **DI > service locator. Always.**

### Q3. *"Where do you wire everything up if you're doing manual DI?"*

**Answer.** In a single place called the **composition root** — usually `main.ts`, `index.ts`, or `app.ts`. That file:

1. Reads config (env vars).
2. Constructs concrete dependencies in the right order (db → repos → services → controllers).
3. Hands the top-level object to the framework (Express, Koa, etc.) to start.

Below the composition root, **no class ever calls `new` on a service or repository**. They only construct their own internal data (`new Date()`, `new Map()`). This pattern is sometimes called the **"new is glue"** rule.

### Q4. *"How does DI relate to the SOLID principles?"*

**Answer.** It's the practical implementation of two principles:

- **D — Dependency Inversion Principle:** "high-level modules should depend on abstractions, not on low-level modules." DI achieves this by accepting interfaces in the constructor.
- **S — Single Responsibility Principle:** by *not* having to construct its own dependencies, the class is freed to do one thing — its actual job. Wiring is someone else's responsibility.

It also indirectly supports:
- **O — Open/Closed:** swap a new implementation by injecting a different concrete class; the consuming class doesn't change.
- **L — Liskov Substitution:** any object implementing the interface can be injected.
- **I — Interface Segregation:** classes inject *only* the interfaces they need (not a god `Service` with 20 methods).

Phase 2 will deep-dive these.

### Q5. *"Show me how you'd test this code."*
```ts
class NotificationService {
  constructor(private readonly emailer: EmailService, private readonly users: UserRepository) {}

  async notify(userId: string, msg: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new Error("user not found");
    await this.emailer.send(user.email, msg);
  }
}
```

**Answer.**
```ts
test("notify sends an email to the user's address", async () => {
  const sentTo: string[] = [];
  const emailer: EmailService = {
    send: async (to, _msg) => { sentTo.push(to); },
  };
  const users: UserRepository = {
    findById: async () => ({ id: "u1", email: "a@x.com", name: "A" }),
  } as UserRepository;

  const svc = new NotificationService(emailer, users);
  await svc.notify("u1", "hello");

  expect(sentTo).toEqual(["a@x.com"]);
});

test("notify throws when user not found", async () => {
  const emailer: EmailService = { send: async () => {} };
  const users: UserRepository = { findById: async () => null } as UserRepository;
  const svc = new NotificationService(emailer, users);
  await expect(svc.notify("missing", "hi")).rejects.toThrow();
});
```

The tests are short and have **no infrastructure**. That's the smell of DI being done right.

### Q6. *"What's a downside of DI?"*

**Answer.** Three honest trade-offs:
1. **Boilerplate.** Wiring up many classes manually is verbose. Frameworks (NestJS, Inversify) help, at the cost of magic.
2. **Indirection.** A reader has to follow the composition root to know which concrete class is actually used. Debuggers help, but it's an upfront cognitive cost.
3. **Over-engineering risk.** Not every tiny class needs an interface and an injection. For pure-function helpers (`StringUtils.slugify`), DI adds no value. Use DI where you have **collaborators with side effects** (DB, network, FS, time, randomness) — exactly the things you'd want to mock.

A senior engineer is *selective* about DI: aggressive at the boundaries between modules, light inside.

### Q7 (bonus). *"What is the 'composition root' and why does it matter?"*

**Answer.** It's the **single place** in your application where concrete classes are instantiated and wired together. Everything else only declares dependencies it needs (via constructor). Why it matters:

- It's the only place that knows about specific implementations — Postgres, Stripe, console logger.
- Tests use a different composition (with mocks) — without re-architecting anything.
- Rolling out a new implementation = changing one file.
- Reasoning about the system reduces to "what does main.ts wire up?"

Mature TS codebases keep `main.ts` short, declarative, and boring. That's the goal.

---

## Recap — what to remember

1. **Dependency Injection** — give a class its collaborators from outside, don't let it create them.
2. Use **constructor injection** by default. Setter injection and interface injection are rarer.
3. **Inject interfaces, not concrete classes.** That's what makes implementations swappable.
4. The **composition root** (usually `main.ts`) is the *only* place that does the wiring. Everything else just declares.
5. DI is what makes unit tests trivial — mocks are just object literals matching the interface.
6. DI is the practical implementation of the **Dependency Inversion Principle**, the D in SOLID.
7. **Don't over-DI.** Pure helpers (string utils, math) don't need it. Apply DI where collaborators have side effects (DB, HTTP, FS, time).

---

# 🎉 Phase 1 complete

You've finished the TypeScript foundation for LLD. Recap of what we covered:

| # | Topic | Key takeaway |
|---|-------|--------------|
| 01 | Classes, Objects & Access Modifiers | A public field is a public commitment — start `private`. |
| 02 | Interfaces & Abstract Classes | Default to interface; promote to abstract class when shared code appears. |
| 03 | Inheritance & Polymorphism | Polymorphism is the actual win; inheritance is one way to get there. |
| 04 | Composition vs Inheritance | Favor composition over inheritance — varying behavior = strategy you hold. |
| 05 | Generics | One implementation, infinite types. Use `<T>` instead of `any`. |
| 06 | Statics & Enums | Statics for pure helpers/factories only. Prefer string-literal unions over enums. |
| 07 | Utility Types | Derive, don't duplicate. The Big Six: `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`. |
| 08 | Dependency Injection | Inject interfaces via constructor. Composition root wires it all up. |

## What's next — Phase 2: OOP & SOLID

Now we shift from *language features* to *design principles*. Phase 2 is where LLD really begins.

- **Encapsulation, Abstraction, Inheritance, Polymorphism** — formalized.
- **SOLID Principles** — five rules, with violations, refactors, and interview-grade examples.
- **Composition vs Inheritance, revisited at a deeper level.**

When you're ready, just say the word and we'll start with Lesson 09 — the **Four Pillars of OOP** in depth.
