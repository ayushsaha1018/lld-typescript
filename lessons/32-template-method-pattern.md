# 32 — Template Method Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, easy to misuse with deep inheritance

---

## 1. Concept / Theory

**Template Method** defines the **skeleton** of an algorithm in a base class, leaving certain **steps** for subclasses to override. The skeleton's order is fixed; the steps' implementations vary.

The pattern shows up wherever you find:

* "Three subclasses do almost the same thing — only one or two steps differ."
* "I want to enforce that *something always happens before/after the body* (cleanup, transactions, retries)."
* "Subclasses must do X, Y, Z in this order — they shouldn't be able to reorder them."

```
   ┌────────────────────────────┐
   │     AbstractClass          │
   │ ──────────────────────────│
   │  + templateMethod() {     │   ← this is "final" (or by convention not overridden)
   │      step1();             │     it defines the skeleton
   │      step2();             │
   │      hookA();             │
   │      step3();             │
   │      hookB();             │
   │    }                      │
   │  - step1(): abstract      │   ← required overrides
   │  - step2(): abstract      │
   │  - step3(): abstract      │
   │  + hookA(): default {}    │   ← optional overrides ("hooks")
   │  + hookB(): default {}    │
   └────────────────────────────┘
                △
                │
                │ extends
                │
   ┌────────────────────────────┐
   │     ConcreteClass          │
   │ ──────────────────────────│
   │  - step1() override        │
   │  - step2() override        │
   │  - step3() override        │
   │  + hookA() override        │ (only if needed)
   └────────────────────────────┘
```

### Two kinds of overridable methods

* **Primitive operations** — abstract methods. Subclasses **must** implement them.
* **Hooks** — concrete methods with default implementations (often empty). Subclasses **may** override them. Useful for optional pre/post behavior the skeleton wants to *allow* but not *require*.

### The Hollywood Principle

The template method follows what's nicknamed the **Hollywood Principle**: *"Don't call us, we'll call you."* The base class controls the flow; subclasses provide the parts. Subclasses don't call the base class; the base class calls into them at well-defined points.

That's the inversion-of-control feature you're really buying with this pattern. The base class enforces the algorithm's invariants — order of steps, error handling, transaction boundaries — and the subclasses can't get those wrong because they don't get to write the skeleton.

### Make the template method "final" by convention

In Java/C#, you literally mark the template method `final` so subclasses can't override the skeleton. TS doesn't have a `final` keyword, but you can express it with comments (`/** @final */`), with a `private` skeleton method that delegates to a `protected` template, or just by convention. The intent: subclasses provide *steps*, not the *structure*.

### Template Method vs Strategy (the most-asked confusion)

Both let an algorithm vary, but at different *granularities*:

* **Strategy** replaces the *whole* algorithm. The Context holds a Strategy reference; swapping the Strategy swaps the entire computation. **Composition over inheritance.**
* **Template Method** keeps the algorithm's *skeleton* fixed and varies *specific steps*. Subclasses inherit from a base. **Inheritance, with hooks for variation.**

Mental model: Strategy is "pick a different recipe." Template Method is "same recipe, different ingredients in step 3."

We'll cover this in detail in interview questions; in modern code, *prefer Strategy* unless the algorithm has a genuinely fixed skeleton with locked invariants.

---

## 2. Real-life Analogy

**Making coffee or tea.** The skeleton is identical:

1. Boil water.
2. Brew (the variable part — coffee grounds vs tea leaves).
3. Pour into cup.
4. Add condiments (milk, sugar — variable).

A barista following the recipe doesn't reinvent the order. They follow the steps; only steps 2 and 4 differ between coffee and tea. That's Template Method: the recipe is fixed; specific steps vary by drink.

Other clean analogies:

* **A standardized workout.** Warm up → main exercise → cool down. The "main exercise" is the variable; warm-up and cool-down are mandatory.
* **Test framework lifecycle.** `beforeEach` → `test body` → `afterEach`. Test authors only write the body; the framework guarantees setup and teardown happen around it.
* **A game's main loop.** `init()` → `while running { update(); render(); }` → `cleanup()`. Game-specific code goes in `update` and `render`; the loop structure is the engine's responsibility.
* **A standardized form approval.** Receive → validate → log → process → notify. Each step's *details* differ per form type; the order doesn't.

---

## 3. Bad Code Example — Duplicated Workflows With Subtle Drift

What happens when subclasses re-implement the whole algorithm to vary one step.

```ts
// ❌ BAD: every report subclass re-implements the entire workflow
class CsvReport {
  generate(data: any[]) {
    console.log("opening file");
    const formatted = data.map(d => `${d.id},${d.name},${d.total}`).join("\n");
    console.log("writing");
    writeFile("out.csv", `id,name,total\n${formatted}`);
    console.log("closing file");
    notifyAdmin("CSV report ready");
  }
}

class JsonReport {
  generate(data: any[]) {
    console.log("opening file");
    const formatted = JSON.stringify(data, null, 2);
    console.log("writing");
    writeFile("out.json", formatted);
    console.log("closing file");
    notifyAdmin("JSON report ready");
  }
}

class PdfReport {
  generate(data: any[]) {
    console.log("opening file");
    const formatted = renderPdf(data);
    // SOMEONE FORGOT THE LOG LINE — silent drift
    writeFile("out.pdf", formatted);
    console.log("closing file");
    notifyAdmin("PDF report ready");
  }
}
```

What's wrong:

1. **Skeleton is duplicated three times.** Open → format → write → close → notify is repeated, and one variant (`PdfReport`) has already drifted.
2. **No enforcement.** A new report type might forget the notify step entirely. Nothing stops them.
3. **Hard to add cross-cutting concerns.** Want metrics around every report? Edit three classes.
4. **Order can drift.** What if `JsonReport` decides to notify *before* writing for some reason? Nothing in the type system prevents it.

Template Method centralizes the workflow and only allows variation at the designated step.

---

## 4. Good Code Example — Template Method in TypeScript

### 4a. Report generator with a fixed skeleton

```ts
// ============================================================
// 1) Abstract base — owns the skeleton; defers the variable bit
// ============================================================
abstract class Report {
  // The template method — skeleton, not to be overridden
  generate(data: unknown[]): void {
    this.open();
    const formatted = this.format(data);          // ← variable step
    this.write(formatted);
    this.close();
    this.onAfterGenerate();                        // ← optional hook
    this.notify();
  }

  // primitive (required) operations
  protected abstract format(data: unknown[]): string;
  protected abstract write(content: string): void;

  // shared concrete steps
  protected open()    { console.log("opening file"); }
  protected close()   { console.log("closing file"); }
  protected notify()  { notifyAdmin(`${this.constructor.name} ready`); }

  // hook — empty by default, subclasses may override
  protected onAfterGenerate(): void { /* default: do nothing */ }
}

// ============================================================
// 2) Concrete classes — only override what differs
// ============================================================
class CsvReport extends Report {
  protected format(data: any[]) {
    const header = "id,name,total";
    return [header, ...data.map(d => `${d.id},${d.name},${d.total}`)].join("\n");
  }
  protected write(content: string) { writeFile("out.csv", content); }
}

class JsonReport extends Report {
  protected format(data: any[]) { return JSON.stringify(data, null, 2); }
  protected write(content: string) { writeFile("out.json", content); }
}

class PdfReport extends Report {
  protected format(data: any[]) { return renderPdf(data); }
  protected write(content: string) { writeFile("out.pdf", content); }

  // subclass uses the optional hook
  protected onAfterGenerate(): void {
    console.log("compressing pdf");
    runCompression("out.pdf");
  }
}

// ============================================================
// 3) Usage — the skeleton is identical across types
// ============================================================
const reports: Report[] = [new CsvReport(), new JsonReport(), new PdfReport()];
for (const r of reports) r.generate(data);
```

What changed:

* **The skeleton lives in one place.** Order, logging, notification, hook — all guaranteed.
* **Subclasses only fill in the holes.** No way to skip notification or reorder steps.
* **`PdfReport` adds compression via the hook** without changing the base class.
* **Adding `XmlReport` is two methods.** No risk of forgetting the workflow steps.

### 4b. Test framework (the canonical real-world example)

Every Jest / Mocha / JUnit test you've ever written runs through a Template Method-like skeleton:

```ts
abstract class TestCase {
  // template method — final by convention
  run(): void {
    this.beforeAll();
    try {
      this.beforeEach();
      try {
        this.test();
      } finally {
        this.afterEach();
      }
    } finally {
      this.afterAll();
    }
  }

  protected abstract test(): void;
  protected beforeAll()  {}
  protected beforeEach() {}
  protected afterEach()  {}
  protected afterAll()   {}
}

class UserServiceTest extends TestCase {
  private user!: User;

  protected beforeEach() {
    this.user = createTestUser();
  }
  protected test() {
    expect(this.user.name).toBe("Test");
  }
  protected afterEach() {
    deleteTestUser(this.user.id);
  }
}
```

The framework guarantees setup-test-teardown ordering even when the test throws. The author writes only the parts that vary.

### 4c. Composition alternative — Template Method without inheritance

In modern TS, you can often achieve the same effect without inheritance by using *function composition*. This is the "Template Method via higher-order function" idiom.

```ts
// Skeleton as a function that takes the variable steps as callbacks
function generateReport(opts: {
  format: (data: unknown[]) => string;
  write: (content: string) => void;
  filename: string;
  onAfterGenerate?: () => void;
}) {
  return (data: unknown[]) => {
    console.log("opening file");
    const formatted = opts.format(data);
    opts.write(formatted);
    console.log("closing file");
    opts.onAfterGenerate?.();
    notifyAdmin(`${opts.filename} ready`);
  };
}

const csvReport = generateReport({
  filename: "out.csv",
  format: (d: any[]) => `id,name,total\n` + d.map(x => `${x.id},${x.name},${x.total}`).join("\n"),
  write: (c) => writeFile("out.csv", c),
});

csvReport(data);
```

Same skeleton, no inheritance. This is the modern preference when you don't need a deep type hierarchy. **Mention it in interviews** as the composition-flavored alternative — it shows you don't reach for inheritance reflexively.

### 4d. Combining Template Method with Hooks for transaction boundaries

A classic real-world use: ensuring a database transaction wraps every operation in a service.

```ts
abstract class TransactionalService<T> {
  async run(input: unknown): Promise<T> {
    const tx = await db.beginTransaction();
    try {
      this.preCheck(input);
      const result = await this.doWork(tx, input);
      this.postCheck(result);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  protected abstract doWork(tx: Tx, input: unknown): Promise<T>;
  protected preCheck(_: unknown)  {}   // hook
  protected postCheck(_: T)        {}   // hook
}
```

Subclasses can't forget to begin or commit a transaction; the skeleton enforces it. Subclasses only write `doWork` (and optional checks). This is one of the cleanest applications of Template Method in production code.

---

## 5. Real-world Use Cases

* **Test frameworks** — JUnit, Jest, Mocha, Vitest. `beforeAll → beforeEach → test → afterEach → afterAll` is a Template Method skeleton.
* **Servlet `doGet` / `doPost`** — Java's `HttpServlet.service()` is the template method that dispatches to method-specific overrides.
* **React class component lifecycle (legacy)** — `componentWillMount → render → componentDidMount` with optional `componentDidUpdate`. The framework calls into your overrides at fixed points.
* **Game engine main loops** — Unity's `Start → Update → LateUpdate → OnDestroy`; Unreal's `BeginPlay → Tick → EndPlay`. You override the variable bits; the engine owns the loop.
* **Spring's `JdbcTemplate.execute(...)`** — the textbook example. The template handles connection acquisition, exception translation, and resource cleanup; you only provide the SQL-specific callback.
* **NestJS guards / interceptors / pipes** — base classes whose template methods enforce timing of pre/post logic.
* **HTTP client base classes** — generated SDKs often expose a base class with a template `request()` method that handles auth, retries, serialization; subclasses override per-endpoint specifics.
* **Build tool tasks** — Gradle / Maven plugins inherit from a base task class with template methods for setup/run/teardown.
* **Compilers / interpreters** — visitor base classes in ASTs; the visitor's `visit()` is a dispatcher that calls type-specific `visitX()` methods.
* **Authentication strategy base class** — Passport.js's `Strategy` has a template-ish flow; concrete strategies fill in `authenticate()`.
* **Algorithm libraries** — sorting algorithms with a `compare()` hook; `Comparable.compareTo()` in Java; even custom `compareFn` in JS sort is hook-shaped.
* **Form rendering libraries** — base `Form` class with `validate → submit → onSuccess / onError` skeleton; subclasses fill in the specifics.
* **Migration runners** — `up()` / `down()` overridden by each migration; the runner enforces transactional execution.
* **Stream pipelines** — Node's `Transform` stream subclassing with `_transform()` and `_flush()` is Template Method.

When you see a class that says "extend me and override these methods" — especially with a fixed lifecycle of `init`, `body`, `cleanup` — that's Template Method.

---

## 6. Interview Questions

### Q1. What's the difference between Template Method and Strategy?

**Answer:** Both let an algorithm vary, but at different *granularities* and through different *mechanisms*.

* **Strategy** replaces the *entire algorithm* via composition. The Context holds a Strategy reference; swap the reference, swap the algorithm. Different strategies are independent classes that share an interface but have no inheritance relationship.
* **Template Method** keeps the algorithm's *skeleton* fixed in a base class and lets subclasses override specific *steps*. Variation is via inheritance.

A useful analogy: Strategy is "pick a different recipe entirely." Template Method is "same recipe, but step 3 changes by chef."

When to pick which:

* **Strategy** when the *whole* operation is what varies, when you want to swap algorithms at runtime, when you want composition over inheritance, when there's no "skeleton" to enforce.
* **Template Method** when the algorithm has a *real, invariant skeleton* you want to lock down — transaction boundaries, ordering of steps, cleanup guarantees — and only the body varies.

In modern code, **prefer Strategy** unless the skeleton is genuinely inviolate. Template Method ties variants to a class hierarchy; Strategy keeps them independent. The composition-flavored Template Method (4c) gives you most of Template Method's benefit without the inheritance.

A senior framing: "I'd reach for Strategy first. I'd reach for Template Method when there's a transaction boundary, error-handling envelope, or step ordering that's unsafe to leave to callers."

---

### Q2. What is the "Hollywood Principle" and how does Template Method embody it?

**Answer:** *"Don't call us, we'll call you."* It's a slogan for *inversion of control*: instead of high-level code calling into low-level code, low-level code is *called by* the high-level framework at well-defined points.

Template Method is a textbook embodiment. The base class owns the flow:

```ts
generate(data) {
  this.open();
  this.format(data);      // ← the framework calls into your override
  this.close();
}
```

The subclass doesn't call `super.generate()` and pick when to do its work. The base class invokes the subclass's hooks. The subclass *responds*; it doesn't *drive*.

This matters because the base class enforces the algorithm's invariants — transactions, cleanup, error handling, step ordering — and the subclass *can't get them wrong* because it doesn't own the flow.

Other patterns share this principle: Observer (the Subject calls Observers at events), Strategy (the Context calls into the Strategy), event-driven frameworks (the framework calls your handler).

---

### Q3. What's the difference between a hook and a primitive operation?

**Answer:** Both are points of variation in the template method, but they differ in obligation.

* **Primitive operations** are abstract — subclasses **must** implement them. They represent the variable steps the algorithm fundamentally needs (e.g., `format()` in a report — every report has to format somehow).
* **Hooks** have a default (often empty) implementation in the base class — subclasses **may** override them. They represent *optional* pre/post behavior the skeleton allows but doesn't require (e.g., `onAfterGenerate()` for an optional compression step).

Why hooks matter: they give subclasses places to extend without forcing every subclass to think about every concern. A `JsonReport` doesn't care about post-processing; it inherits the empty hook. A `PdfReport` overrides the hook to compress.

The interview move: when explaining Template Method, distinguish "must override" steps (primitive) from "may override" steps (hooks). Showing you know both makes you sound like you've actually used the pattern.

---

### Q4. Why is the template method usually marked "final"? What goes wrong if it isn't?

**Answer:** Marking the template method `final` (or maintaining the discipline by convention in TS) prevents subclasses from overriding the *skeleton*. This is critical because the skeleton encodes the algorithm's invariants — transaction boundaries, cleanup guarantees, step ordering, error handling.

If a subclass overrides the template method itself, all bets are off:

* They might forget to call `super.method()`, skipping every base-class concern.
* They might call the steps in the wrong order, breaking invariants.
* They might omit error handling, leaving connections leaked or transactions uncommitted.

The whole pattern's value is "the base class enforces these properties, subclasses can't break them." Allowing the template method itself to be overridden defeats that.

In Java/C#: literally `public final void run() { ... }`. In TS: no language support, but you can:

1. Declare the template method `private` and have it called via a `public` entry point — subclasses can't see it to override.
2. Mark it with `/** @final */` JSDoc and rely on convention/lint rules.
3. Use composition (the function form in 4c), which sidesteps the issue entirely — there's no class hierarchy to override into.

The senior take: this is one of TS's weak spots vs Java for Template Method. Worth mentioning in interviews if pressed.

---

### Q5. Walk me through using Template Method for a transactional service base class.

**Answer:** (See section 4d.) Key points:

I'd model it as:

```ts
abstract class TransactionalService<T> {
  async run(input: unknown): Promise<T> {
    const tx = await db.beginTransaction();
    try {
      this.preCheck(input);
      const result = await this.doWork(tx, input);
      this.postCheck(result);
      await tx.commit();
      return result;
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  }

  protected abstract doWork(tx: Tx, input: unknown): Promise<T>;
  protected preCheck(_: unknown)  {}   // hook
  protected postCheck(_: T)        {}   // hook
}

class TransferMoneyService extends TransactionalService<TransferReceipt> {
  protected async doWork(tx: Tx, input: { from: string; to: string; amount: number }) {
    await tx.run(`UPDATE accounts SET balance = balance - ? WHERE id = ?`, [input.amount, input.from]);
    await tx.run(`UPDATE accounts SET balance = balance + ? WHERE id = ?`, [input.amount, input.to]);
    return { txId: tx.id };
  }
  protected preCheck(input: any) {
    if (input.amount <= 0) throw new Error("amount must be positive");
  }
}
```

What this guarantees:

1. **Every service runs inside a transaction.** Subclasses can't forget to begin one.
2. **Every transaction is committed or rolled back.** No leaked transactions.
3. **Errors trigger rollback, then propagate.** Subclass code that throws automatically rolls back — no manual cleanup.
4. **Pre/post checks are optional via hooks.** Services that don't need them inherit the no-op default.
5. **Subclasses focus on `doWork`.** That's the only required method — the algorithm-specific bit.

Alternative composition-form (modern TS preference):

```ts
async function withTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tx = await db.beginTransaction();
  try { const r = await fn(tx); await tx.commit(); return r; }
  catch (e) { await tx.rollback(); throw e; }
}

const transferMoney = (input: TransferInput) => withTransaction(async tx => {
  // body
});
```

The function form gives you the same guarantees without inheritance — and is what most modern TS codebases write. **Mention both** in interviews. Showing you can express the pattern with or without inheritance is senior signal.

---

## TL;DR Cheat Sheet

```
Template Method: define the skeleton of an algorithm in a base class;
                 let subclasses override specific steps.

Recipe:
  1. Base class with a template method that calls steps in order
  2. Steps marked abstract (primitive operations) — must override
  3. Hooks with default no-op bodies — may override
  4. Skeleton method "final" by convention — subclasses don't override it

Use when:
  - several variants share a real, invariant skeleton (order, error handling)
  - you want to enforce transaction / lifecycle / cleanup boundaries
  - subclasses should fill in steps, not reinvent the workflow

Don't use when:
  - the variant should be plugged in at runtime → use Strategy
  - the inheritance hierarchy is getting deep / fragile
  - composition (function-form) suffices

vs Strategy:
  - Strategy: composition; replaces the WHOLE algorithm
  - Template: inheritance; replaces specific STEPS
  - Modern preference: Strategy / function composition unless skeleton
    invariants must be locked down

Hollywood Principle: "Don't call us, we'll call you" — base class drives,
                     subclass responds at fixed extension points.

Composition-form (modern TS): the same idea via higher-order functions
                               — skeleton function takes step callbacks.

Combines well with:
  - Hook methods for optional pre/post extension
  - Factory Method for "create the right thing in step N"

Real-world: test frameworks (beforeEach/afterEach), servlets (doGet),
            React class lifecycle, game engines (init/update/cleanup),
            Spring JdbcTemplate, transactional service base classes,
            stream Transform classes, build pipeline tasks.

Interview gold: transactional service base class. Distinguish
                primitive vs hook. Mention composition-form alternative.
                Settle Template Method vs Strategy clearly.
```
