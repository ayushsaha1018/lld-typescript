# Lesson 10 — SOLID: S — Single Responsibility Principle

> **Phase 2 — OOP & SOLID** · *Lesson 2 of 6*
> The most quoted, the most misquoted, and the most useful SOLID rule. Get this right and the next four come naturally.

---

## 1. Concept / Theory

### The popular (and slightly wrong) version
> *"A class should do only one thing."*

You've heard this. It's not wrong, but it's vague — "one thing" can mean anything from "compute a number" to "run an entire microservice."

### Robert C. Martin's actual definition (the precise one)
> *"A class should have only one reason to change."*

And the more recent refinement, from his 2018 book *Clean Architecture*:

> *"A module should be responsible to one, and only one, **actor**."*
> — where an "actor" means a *group of stakeholders* that requests changes for the same business reason.

This phrasing is the *real* SRP. Reread it.

### What "actor" means in practice

Different actors → different reasons to change → different responsibilities → different classes.

| Actor                | Asks for changes when…                    |
| -------------------- | ----------------------------------------- |
| Finance team         | tax rules change                          |
| HR team              | leave policy changes                      |
| Marketing team       | email copy changes                        |
| Compliance team      | data-retention rules change               |
| Database admin       | schema or query optimization changes      |
| Frontend / UI team   | display formatting changes                |

If a single class would have to be edited because finance changed a tax rule **and again** because HR changed a leave policy, that class serves two actors → it has two responsibilities → it violates SRP.

### Why SRP matters

1. **Change isolation.** A class with one reason to change rarely surprises you when you edit it.
2. **Reduced merge conflicts.** Two teams working on different concerns won't fight over the same file.
3. **Cleaner tests.** A class with one job has a small, specific test surface.
4. **Easier reasoning.** "What does this class do?" should be answerable in one sentence with no "and"s.

The "no `and`" rule is the cheapest practical SRP test:

> If you describe what your class does and the sentence contains "**and**", you probably have multiple responsibilities. Break it up.

### Where SRP applies

SRP is talked about for *classes*, but the same idea scales:

- **Methods** — should do one thing. (`saveUserAndSendEmail` → `saveUser` + `sendEmail`).
- **Modules** / files — should be about one topic. (`utils.ts` is a code smell. `dateFormat.ts`, `currency.ts` aren't.)
- **Microservices** — should serve one bounded context. (a "user-service" that also handles billing, oh no.)

### What SRP is *not*

A common misread: "I'll make every class do exactly one method!" That gives you 200 single-method classes that nobody can navigate. SRP means **one reason to change, not one method**. A class with `add`, `remove`, and `findById` is fine — they all serve the *same actor* (e.g., "the data layer") and change for the *same reasons*.

---

## 2. Real-life Analogy

A **Swiss Army knife** is a tool that violates SRP gloriously: knife + screwdriver + can opener + scissors + tweezers + toothpick. It's fine for a casual hike. It's terrible for a professional kitchen, a workshop, or a hospital.

Why? Because each user — chef, mechanic, surgeon — has *different reasons* to want a different tool. Sharpen the knife edge for the chef → your scissors won't sharpen with it. Replace the screwdriver bit for the mechanic → the chef doesn't care. The tool serves three masters and changes badly for all of them.

A **kitchen** with a chef's knife, a paring knife, a bread knife, a pair of shears — each tool has one purpose, one user, one reason to change. The kitchen is faster, cleaner, and easier to maintain. **That's SRP.**

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — the "Employee" god-class

This is the canonical Robert-Martin example, in TypeScript.

```ts
// ❌ BAD: one class, three actors, three reasons to change
class Employee {
  constructor(
    public readonly id: string,
    public name: string,
    public role: "engineer" | "manager",
    public hoursWorked: number,
  ) {}

  // ── 1) FINANCE-OWNED logic ─────────────────────
  calculatePay(): number {
    const rate = this.role === "manager" ? 100 : 80;
    return this.hoursWorked * rate;
  }

  // ── 2) HR-OWNED logic ──────────────────────────
  reportHours(): string {
    return `${this.name} worked ${this.hoursWorked} hours this week.`;
  }

  // ── 3) DATABASE-OWNED logic ────────────────────
  save(): void {
    /* INSERT INTO employees ... */
  }
}
```

**Why it fails:**

| Actor                   | Asks for change to                    |
| ----------------------- | ------------------------------------- |
| Finance                 | `calculatePay()` — payroll rules      |
| HR                      | `reportHours()` — reporting format    |
| Database admin          | `save()` — schema or query change     |

Three actors, three reasons to change, **one** file. Predictable consequences:

- A change to payroll rules touches the same class as a change to reporting. Reviewers and CI pipelines fight.
- An accidental coupling: `calculatePay` shares fields with `reportHours`; refactoring one changes the other unexpectedly.
- Tests are heavier: any test of `save` needs a database; any test of `calculatePay` should *not*. They're entangled.
- New engineers can't find anything — "where does payroll live?" "well… in `Employee`?"

In real Robert-Martin tellings, this design also leads to actual production bugs when one team's PR silently breaks another team's contract because the shared method changed.

### Bad pattern B — the "Manager" class with side errands

```ts
// ❌ BAD: a class that "manages" too much
class OrderManager {
  async create(order: OrderInput) {
    // 1. validate input
    if (!order.email.match(/@/)) throw new Error("bad email");
    // 2. call DB
    await db.insert("orders", order);
    // 3. compute discount
    const discount = order.total > 1000 ? 0.1 : 0;
    // 4. compute tax
    const tax = order.total * 0.18;
    // 5. format invoice for PDF
    const invoiceMarkdown = `# Invoice\n${order.email}\nTotal: ${order.total}`;
    // 6. send email
    await emailer.send(order.email, "Your order", invoiceMarkdown);
    // 7. log to audit trail
    await auditLog.write({ event: "order_created", at: new Date() });
  }
}
```

This single method has at least six reasons to change: validation rules, DB schema, discount logic, tax rules, invoice format, audit format. It serves **six actors**. Every quarter someone edits it for a different reason; every edit risks breaking the others.

The smell: "describe what this method does." You need six sentences. SRP says: **one** sentence.

---

## 4. Good Code (the right way)

### Refactor of the Employee god-class

Split by actor — one class per reason to change.

```ts
// ── domain entity (pure data + invariants) ──
class Employee {
  constructor(
    public readonly id: string,
    public name: string,
    public role: "engineer" | "manager",
    public hoursWorked: number,
  ) {}
}

// ── FINANCE actor ──
class PayrollCalculator {
  calculate(emp: Employee): number {
    const rate = emp.role === "manager" ? 100 : 80;
    return emp.hoursWorked * rate;
  }
}

// ── HR actor ──
class HoursReporter {
  format(emp: Employee): string {
    return `${emp.name} worked ${emp.hoursWorked} hours this week.`;
  }
}

// ── DATA actor ──
interface EmployeeRepository {
  save(emp: Employee): Promise<void>;
  findById(id: string): Promise<Employee | undefined>;
}
class SqlEmployeeRepository implements EmployeeRepository {
  async save(emp: Employee) { /* INSERT INTO ... */ }
  async findById(id: string) { /* SELECT ... */ return undefined; }
}
```

What's better:

- A change to payroll only touches `PayrollCalculator`. Finance's PRs don't crowd HR's.
- `Employee` is a pure domain object. It's testable without a DB.
- The repository is an interface — concrete implementation can change (Postgres → DynamoDB) without affecting domain or business logic.
- Each class can be described in one sentence with no "and".

### Refactor of the OrderManager mega-method

Pull each responsibility into its own collaborator. Use **DI** (Lesson 08) to wire them up.

```ts
// ── small, single-purpose collaborators ──
class OrderValidator {
  validate(o: OrderInput) {
    if (!o.email.includes("@")) throw new Error("bad email");
    if (o.total <= 0) throw new Error("total must be positive");
  }
}

class DiscountCalculator {
  apply(total: number) { return total > 1000 ? total * 0.1 : 0; }
}

class TaxCalculator {
  compute(total: number) { return total * 0.18; }
}

interface InvoiceFormatter { format(order: Order): string; }
class MarkdownInvoiceFormatter implements InvoiceFormatter {
  format(o: Order) { return `# Invoice\n${o.email}\nTotal: ${o.total}`; }
}

interface AuditLog { write(event: { event: string; at: Date }): Promise<void>; }

// ── orchestrator: ONE responsibility = "place an order" ──
class OrderService {
  constructor(
    private readonly validator: OrderValidator,
    private readonly orders: OrderRepository,
    private readonly discount: DiscountCalculator,
    private readonly tax: TaxCalculator,
    private readonly invoice: InvoiceFormatter,
    private readonly emailer: EmailService,
    private readonly audit: AuditLog,
  ) {}

  async create(input: OrderInput) {
    this.validator.validate(input);

    const discount = this.discount.apply(input.total);
    const tax      = this.tax.compute(input.total - discount);
    const order    = await this.orders.save({ ...input, discount, tax });

    await this.emailer.send(input.email, "Your order", this.invoice.format(order));
    await this.audit.write({ event: "order_created", at: new Date() });

    return order;
  }
}
```

What changed conceptually:

- `OrderService.create` orchestrates — but the *substance* of each step (validation, discount, tax, invoice, audit) lives elsewhere, owned by its actor.
- A discount-rule change → only `DiscountCalculator` changes.
- A tax change → only `TaxCalculator`.
- A schema change → only `OrderRepository`.
- A new invoice format (Markdown → HTML → PDF) → swap the `InvoiceFormatter` implementation.

> A common worry: "isn't that more files?" Yes. **More small files are easier to live with than one big file.** Each is trivially testable, locatable, and replaceable.

### The cheapest SRP heuristic — the "and" test

Apply to every class and method:
- "OrderService **creates orders**." ✅
- "OrderService **creates orders and sends emails and computes tax**." ❌ — split by the "and"s.
- "Employee **calculates pay and reports hours and saves itself**." ❌ — split.
- "PayrollCalculator **computes pay for an employee**." ✅

Get into this habit during code review and design interviews. It's a startlingly fast way to spot bloat.

---

## 5. Real-world Use Cases

- **NestJS module structure.** A typical NestJS module: `OrderController` (HTTP layer), `OrderService` (business logic), `OrderRepository` (persistence), `OrderDto`, `OrderEntity`. Each has one reason to change.
- **DDD layered architecture.** Domain layer, application layer, infrastructure layer — same SRP idea, scaled to layers. Each layer changes for its own reasons.
- **React components done well.** A component that renders a list, fetches the data, computes filters, *and* persists user prefs is a familiar Friday-afternoon mistake. The clean version: a hook fetches data, another hook owns prefs, the component just renders.
- **Microservices boundaries.** Each service should own one bounded context. "user-service" should not also do "billing" — that's literal SRP at the service level.
- **AWS Lambda single-purpose handlers.** Each function does one thing — `processPaymentSucceeded`, `sendOnboardingEmail`. SRP at the function level keeps blast radius small.
- **Linters / formatters.** ESLint owns linting. Prettier owns formatting. They interoperate, but neither does the other's job — and they're each used standalone everywhere because of that.

When you read a famous codebase that "feels good", SRP is usually the dominant feature. When you read one that "feels heavy", it's usually the missing one.

---

## 6. Interview Questions (with answers)

### Q1. *"State the Single Responsibility Principle as Robert C. Martin originally meant it."*

**Answer.** "A module should be responsible to one, and only one, **actor**" — meaning a single group of stakeholders whose changes the module is meant to serve. The popular phrasing "do one thing" is a useful approximation, but the precise definition is about **reasons to change**, not about counting methods.

### Q2. *"Spot the SRP violation in this code."*
```ts
class Report {
  data: any[];
  fetchFromDb() { /* SQL */ }
  calculateTotals() { /* math */ }
  renderHtml() { /* string templating */ }
  sendEmail() { /* SMTP */ }
}
```

**Answer.** At least four actors, four responsibilities:
- *DB / data engineer* owns `fetchFromDb`.
- *Business analyst* owns `calculateTotals` (the formulas).
- *Designer / frontend* owns `renderHtml`.
- *Ops / infra* owns `sendEmail`.

The fix is the same shape as the OrderService refactor above: a `ReportService` orchestrator, with a `ReportRepository`, a `ReportCalculator`, a `ReportRenderer`, and an `EmailService` injected. Each is testable on its own; each changes for its own reasons.

### Q3. *"Doesn't SRP just produce a million tiny classes?"*

**Answer.** Only if you *misapply* it. SRP says "one reason to change," not "one method per class." A `UserRepository` with `findById`, `save`, `delete`, `list` is fine — those four methods all change for the same reason (the data layer's needs). Splitting them further wouldn't reduce coupling; it would just increase navigation overhead. **One reason to change, not one method.**

### Q4. *"How is SRP related to the Open/Closed Principle?"*

**Answer.** They reinforce each other:

- SRP keeps a class focused on one reason to change.
- OCP says you should be able to add new behavior without changing existing code.

When SRP is honored, OCP is easier to honor — because each class is small enough that *swapping it* (rather than editing it) is feasible. Conversely, a god class violates SRP **and** is impossible to extend without modification (you can't avoid editing the central blob). They tend to fail or succeed together.

### Q5. *"Refactor this method to comply with SRP."*
```ts
async function registerUser(input: RegisterInput) {
  if (!input.email.includes("@")) throw new Error("bad email");
  if (input.password.length < 8) throw new Error("weak password");
  const hash = await bcrypt.hash(input.password, 10);
  const user = await db.insert("users", { ...input, password: hash });
  await ses.send({ to: input.email, body: `Welcome, ${input.name}` });
  console.log(`[audit] user ${user.id} registered at ${new Date().toISOString()}`);
  return user;
}
```

**Answer.** Five responsibilities: validation, password hashing, persistence, email, audit. Refactor:

```ts
class UserRegistration {
  constructor(
    private readonly validator: InputValidator,
    private readonly hasher: PasswordHasher,
    private readonly users: UserRepository,
    private readonly emailer: EmailService,
    private readonly audit: AuditLog,
  ) {}

  async register(input: RegisterInput) {
    this.validator.validate(input);
    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.save({ ...input, passwordHash });
    await this.emailer.send(input.email, "Welcome", `Welcome, ${input.name}`);
    this.audit.log("user_registered", user.id);
    return user;
  }
}
```

Each collaborator is mockable in tests. Each can change for its own reason without dragging the others into the diff.

### Q6. *"What's the cheapest test for whether a class violates SRP?"*

**Answer.** Try to describe the class in **one sentence with no 'and's**. If you can't, you have multiple responsibilities. A second test: count the *kinds of stakeholders* (or teams) whose changes would force you to edit the class. If the answer is more than one, split.

### Q7. *"Where does SRP push back against itself?"*

**Answer.** Two real tensions to flag:
1. **Cohesion vs splitting.** Splitting too eagerly produces classes whose methods are split across files for no good reason — the classes lose cohesion. SRP is about *reasons to change*, so methods that always change together belong together.
2. **Performance / locality.** Sometimes splitting a class introduces unnecessary indirection where a single class would have been simpler and faster (especially in hot loops). SRP is a design rule, not a religion. In the rare case where simplicity wins decisively, keep it together — but document why.

A senior engineer applies SRP **rigorously** at module/service boundaries (where actors really differ) and **loosely** inside small algorithmic helpers (where there is only one actor anyway).

---

## Recap — what to remember

1. **SRP = one reason to change.** Not "one method", not "one thing".
2. Different **actors** = different responsibilities. Find the actors first.
3. Apply the **"and" test** — describe the class in one sentence; if you need "and", split.
4. SRP-violating classes are usually called `XManager`, `XHandler`, `XHelper`, or `Utils`.
5. SRP and OCP tend to **succeed or fail together** — fixing one usually helps the other.
6. **Don't atomize.** SRP is about cohesion of *reasons*, not method counts.

---

## What's next
Lesson 11 — **SOLID: O — the Open/Closed Principle**: how to design code that's *open for extension, closed for modification*, and why polymorphism is the engine that makes it possible.
