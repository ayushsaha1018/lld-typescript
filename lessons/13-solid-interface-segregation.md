# Lesson 13 — SOLID: I — Interface Segregation Principle

> **Phase 2 — OOP & SOLID** · *Lesson 5 of 6*
> "Don't force a class to implement methods it doesn't need." Small, role-based interfaces beat fat, do-everything ones — every time.

---

## 1. Concept / Theory

### The definition

> *"Clients should not be forced to depend upon interfaces they do not use."*
> — Robert C. Martin

In other words: **no class should be obligated to implement methods that don't apply to it.** Split big interfaces into small, focused ones, each describing **one role**.

### What "client" means here

In SOLID-speak, a *client* is anything that *uses* an interface — a function that takes the interface as an argument, a class that holds it as a field, a module that imports it. ISP is a rule about **how interfaces are designed for their clients**, and the smell is when one interface tries to serve too many clients with different needs.

### Fat interface vs role-based interfaces

```ts
// ❌ Fat interface — many unrelated capabilities
interface IDevice {
  print(doc: Doc): void;
  scan(): Doc;
  fax(doc: Doc, number: string): void;
  staple(): void;
  refillToner(): void;
}
```

What if you have a *plain printer* — no scanner, no fax, no stapler? You'd be forced to implement all five methods on a class that only does *one*. That's the ISP violation.

```ts
// ✅ Role-based interfaces — small, focused
interface Printer { print(doc: Doc): void; }
interface Scanner { scan(): Doc; }
interface Fax     { fax(doc: Doc, number: string): void; }
interface Stapler { staple(): void; }

// A simple inkjet only implements what it does
class Inkjet implements Printer { print(d: Doc) {/*...*/} }

// A multifunction device composes the roles it actually plays
class XeroxAllInOne implements Printer, Scanner, Fax {
  print(d: Doc) {/*...*/}
  scan(): Doc {/*...*/ return {} as Doc; }
  fax(d: Doc, n: string) {/*...*/}
}
```

Each class implements **only the roles it plays**. No no-ops. No `throw new Error("not supported")`. No lying. **That's ISP working.**

### The smells of an ISP violation

1. A class **throws "not implemented"** for methods it inherited / had to implement. (Same as the LSP smell — the two principles are deeply related.)
2. Empty / no-op method bodies that exist only to satisfy the interface.
3. Tests that mock interfaces have to fill in **methods that the test never exercises**.
4. The interface name is a vague catch-all: `IService`, `IManager`, `IHelper`.
5. The same interface is used by very different clients (a UI rendering layer and a background job runner share an interface — they shouldn't).
6. Adding a new method to the interface forces edits in many unrelated implementers.

### Why ISP matters

- **Cleaner contracts.** A client should depend on the *exact* shape it needs — nothing more, nothing less.
- **Easier mocking.** A 1-method interface needs a 1-method mock.
- **Independent evolution.** A change to the `Stapler` interface doesn't ripple to `Inkjet`.
- **Honest type system.** A `Printer` parameter signals exactly what the function uses. No surprises.
- **Better composition.** Multifunction devices implement multiple small interfaces — that's the *natural* shape of the real world.

### ISP and LSP — the close cousins

LSP catches a subclass that **lies about substituting** the parent.
ISP often catches the **upstream cause**: the parent's interface is too wide.

If `Penguin extends Bird` had to throw on `fly()` (LSP violation, refused bequest), the *real* problem was that `Bird` declared a method that not all birds support. Splitting `Bird` into `Bird + FlyingBird` (ISP fix) eliminates the LSP violation downstream. **ISP prevents many LSP violations from happening in the first place.**

### Important nuance — don't atomize

Just like SRP, ISP can be *over-applied*. A 1-method interface for every conceivable variation produces interface soup. The right granularity is **role-based** — group methods that are *always* used together by the same kind of client. Cohesive, not fragmented.

---

## 2. Real-life Analogy

A **Swiss Army knife** is the LSP/ISP textbook villain (we used the same image for SRP — it's a multi-violation device). It crams knife, scissors, screwdriver, can-opener, toothpick into one body. As a *user* of the knife, you have to carry every blade even when you only need scissors. ISP says: **a small chef's knife** for the chef, **a small pair of scissors** for the tailor. Each tool serves one role; users grab the one that fits.

Now think of a software example: imagine you sign up for a job board. The "user profile" form asks: name, email, phone, languages spoken, dress measurements, vegetarian preference, blood type, scuba certifications, employer ID, social security number. You'd close the page. Why does *the job board* need your shoe size?

**One fat form, many unhappy users.** That's an ISP violation in product form. The fix is a small *applicant* form, a small *employer* form, a small *recruiter* form — each role-based, each client gets the small interface that fits them.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — the "Worker" interface that includes Robot duties

A classic Robert-Martin example, in TypeScript.

```ts
// ❌ BAD: one interface tries to be everything
interface Worker {
  work(): void;
  eat(): void;       // because human workers eat
  sleep(): void;     // because human workers sleep
}

class HumanWorker implements Worker {
  work()  { /* ... */ }
  eat()   { /* ... */ }
  sleep() { /* ... */ }
}

// New requirement: factory robot
class RobotWorker implements Worker {
  work()  { /* ... */ }
  eat()   { throw new Error("robots don't eat"); }      // 👀 refused bequest
  sleep() { throw new Error("robots don't sleep"); }    // 👀 refused bequest
}

// And the canteen system that schedules meals:
function bookCanteenSlot(workers: Worker[]) {
  for (const w of workers) w.eat();        // 💥 crashes on robots
}
```

The interface assumed every worker is a human. The robot inherits methods it can't honor. The canteen — a *client* of `Worker` — crashes silently when it gets a non-human. ISP violation upstream produces an LSP violation downstream.

### Bad pattern B — the "IService" with 25 methods

```ts
// ❌ BAD: catch-all data service
interface UserService {
  findById(id: string): Promise<User>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;

  exportToCsv(filter: Filter): Promise<string>;
  generateMonthlyReport(): Promise<Report>;
  sendPasswordResetEmail(email: string): Promise<void>;
  banUserAndPostOnSlack(id: string, reason: string): Promise<void>;

  cacheStats(): Promise<CacheStats>;
  clearCache(): Promise<void>;
  healthCheck(): Promise<HealthInfo>;

  // ... 15 more methods
}

class UserController {
  // I only need findById, but I depend on the FULL UserService:
  constructor(private readonly users: UserService) {}
  async getUser(id: string) { return this.users.findById(id); }
}
```

Problems:
- `UserController` depends on a 25-method interface to use *one* method.
- Mocking `UserService` in `UserController`'s tests means writing 25 stub methods.
- A new method on `UserService` (any of the unrelated ones) forces a re-mock everywhere.
- Different clients (controller, admin tool, billing engine) all import the same fat interface, even though they need wildly different subsets.

### Bad pattern C — props that ask for everything

```ts
// ❌ BAD (React example): every child gets the entire parent state
interface AppState {
  user: User;
  theme: Theme;
  cart: Cart;
  notifications: Notification[];
  flags: FeatureFlags;
  /* ... */
}

function PriceTag({ state }: { state: AppState }) {   // 👀 only needs `cart`
  return <span>{state.cart.subtotal}</span>;
}
```

`PriceTag` *uses* one slice — `state.cart.subtotal` — but its declared *contract* is the entire `AppState`. Any unrelated change to `AppState` (a new flag, a new notification type) forces re-rendering, re-mocking, and re-typing this component.

ISP at the component level says: **declare exactly what you use** (`{ subtotal: number }` or `Pick<AppState['cart'], 'subtotal'>`). We previewed exactly this in Lesson 07 (utility types) — `Pick` and `Omit` are the practical tools for ISP at the type level.

---

## 4. Good Code (the right way)

### Fix for the Worker / Robot trap

Split the fat interface into roles. Compose the roles a class actually plays.

```ts
// ✅ Role-based interfaces
interface Workable  { work(): void; }
interface Eatable   { eat(): void; }
interface Sleepable { sleep(): void; }

class HumanWorker implements Workable, Eatable, Sleepable {
  work()  { /* ... */ }
  eat()   { /* ... */ }
  sleep() { /* ... */ }
}

class RobotWorker implements Workable {
  work()  { /* ... */ }
  // no `eat`, no `sleep` — it's not in the contract
}

// Canteen takes only what it needs
function bookCanteenSlot(diners: Eatable[]) {
  for (const d of diners) d.eat();
}

bookCanteenSlot([new HumanWorker()]);    // ✅
bookCanteenSlot([new RobotWorker()]);    // ❌ caught at compile time
```

Now the type system *enforces* the rule. The canteen function says "I need things that can `eat`." Robots are excluded by the compiler. **The bug becomes a type error before it can become a crash.**

### Fix for the fat `UserService`

Group methods by *the kind of client that calls them*. Each group becomes a small interface; one class can implement all of them.

```ts
// ✅ Role-based interfaces — clients depend only on what they use
interface UserReader { findById(id: string): Promise<User>; }
interface UserWriter { save(u: User): Promise<void>; delete(id: string): Promise<void>; }
interface UserExporter { exportToCsv(filter: Filter): Promise<string>; }
interface UserAuth { sendPasswordResetEmail(email: string): Promise<void>; }
interface UserModeration { banUser(id: string, reason: string): Promise<void>; }

// One class can still implement many roles — that's fine
class UserService implements UserReader, UserWriter, UserExporter, UserAuth, UserModeration {
  async findById(id: string)        { /* ... */ return {} as User; }
  async save(u: User)               { /* ... */ }
  async delete(id: string)          { /* ... */ }
  async exportToCsv(f: Filter)      { /* ... */ return ""; }
  async sendPasswordResetEmail(e: string) { /* ... */ }
  async banUser(id: string, r: string)    { /* ... */ }
}

// Each client depends on the smallest interface it needs
class UserController {
  constructor(private readonly users: UserReader) {}        // 👀 only needs reads
  async getUser(id: string) { return this.users.findById(id); }
}

class UserAdminPanel {
  constructor(private readonly users: UserReader & UserModeration) {}  // 👀 reads + ban
  async ban(id: string, reason: string) { return this.users.banUser(id, reason); }
}
```

Note the `&` (intersection) — when a client genuinely needs two roles, you intersect them in the type. The implementation class still combines all the roles into one concrete `UserService` (composition root wires it). What changes is the **type that each client depends on**, which is now the *smallest needed interface*.

Why this is a real win:
- `UserController` mocks need only one method. Tests are tiny.
- A new admin-only method added to `UserModeration` doesn't ripple into `UserController`'s tests or types.
- Different deployment units can import only the roles they need (smaller bundles in the frontend).
- The interface names *describe roles* — code reads better.

### Fix for the React props case

```ts
// ✅ Component depends on the smallest type it uses
function PriceTag({ subtotal }: { subtotal: number }) {
  return <span>{subtotal}</span>;
}

<PriceTag subtotal={state.cart.subtotal} />
```

Or — when the prop list is bigger — use utility types:

```ts
type PriceTagProps = Pick<AppState["cart"], "subtotal" | "currency" | "discount">;
function PriceTag(p: PriceTagProps) { /* ... */ }
```

The component now declares exactly what it uses. Refactor `AppState` (rename `cart` to `basket`) and TS finds every direct user. The minimal interface is also the **most refactorable** interface.

### When ISP and DI work together

```ts
class NotificationDispatcher {
  constructor(
    private readonly users: UserReader,        // doesn't need writes
    private readonly emailer: EmailSender,     // doesn't need scheduling
    private readonly clock: TimeProvider,      // mockable in tests
  ) {}
  /* ... */
}
```

Every dependency is a **small** interface — the smallest the dispatcher actually needs. This is the LLD interview's gold standard: composition (Lesson 04) + DI (Lesson 08) + ISP, all working together.

---

## 5. Real-world Use Cases

- **Node.js streams.** `Readable`, `Writable`, `Duplex`, `Transform` are role-based interfaces. A `Readable` doesn't have `write`; a `Writable` doesn't have `read`. `Duplex` composes both. Clean ISP.
- **DOM event targets.** `EventTarget` is small (`addEventListener`, `removeEventListener`, `dispatchEvent`) — every element gets only the role it plays.
- **TypeScript's `Iterable<T>` and `AsyncIterable<T>`.** Two tiny interfaces. Every collection picks the one (or both) that fit.
- **NestJS lifecycle hooks** — `OnModuleInit`, `OnApplicationBootstrap`, `OnModuleDestroy`. Each hook is its own tiny interface; classes implement only the ones they need.
- **AWS SDK v3 (modular).** The pre-v3 SDK was a fat interface (one `aws-sdk` package, all services). v3 split into role-based packages (`@aws-sdk/client-s3`, `@aws-sdk/client-dynamodb`). Same idea, scaled to the package level.
- **`React.MouseEventHandler`, `React.ChangeEventHandler`** — tiny, specific event-handler types. Each component prop accepts only what it needs.
- **Playwright's `Locator`** — exposes one focused role. You don't get a god `Page` everywhere; you get the *smallest contract* for what you're doing.

The pattern: when a library's design feels "easy to learn", it's almost always because the maintainers honored ISP — small, well-named, composable interfaces.

---

## 6. Interview Questions (with answers)

### Q1. *"State the Interface Segregation Principle and the smell that signals a violation."*

**Answer.** ISP says **clients should not be forced to depend on interfaces they don't use** — interfaces should be small and role-based, not fat and catch-all. The classic smell is **a class that has to implement methods it doesn't actually support**, often signaled by `throw new Error("not implemented")` or empty no-op bodies. Whenever you see those, the interface is too wide for at least one of its implementers.

### Q2. *"Walk me through a fat interface and the refactor."*

**Answer.** A `Worker` interface with `work()`, `eat()`, `sleep()` forces a `RobotWorker` to implement `eat` and `sleep` it can't honor. Refactor: split into `Workable`, `Eatable`, `Sleepable`. `HumanWorker` implements all three; `RobotWorker` implements only `Workable`. Functions now take the smallest interface they need (`bookCanteenSlot(diners: Eatable[])`), and the type system rejects robots at compile time. A bug that used to be a runtime crash becomes a type error.

### Q3. *"How are ISP and LSP related?"*

**Answer.** Tightly. A subclass that throws "not implemented" for an inherited method is an LSP violation (the child can't substitute the parent), but the *root cause* is usually an ISP violation upstream — the parent's interface declared a method that doesn't apply to all children. **ISP fixes the cause; LSP catches the symptom.** Splitting the fat interface into role-based ones eliminates the lying-subclass problem before it can occur.

### Q4. *"Doesn't ISP just mean 'lots of tiny interfaces'? Doesn't that get unwieldy?"*

**Answer.** It can if you over-apply it. The rule is **role-based**, not **method-based**. Group methods that are always used together by the same kind of client. `Reader` (with `find`, `findAll`, `count`) is a healthy role. Splitting `Reader` into `Finder`, `FinderAll`, `Counter` is interface soup. Cohesion of the role is what matters — not method count. The same caveat applies to SRP.

### Q5. *"How do you apply ISP at the type level in TypeScript?"*

**Answer.** Three tools:

1. **Multiple `implements`** — a class implements many small interfaces.
   ```ts
   class S implements UserReader, UserWriter { /*...*/ }
   ```
2. **Intersection types** — a parameter type combines small interfaces.
   ```ts
   function adminTask(svc: UserReader & UserModeration) { /*...*/ }
   ```
3. **`Pick` / `Omit`** — derive the smallest needed type from a larger one.
   ```ts
   function PriceTag(p: Pick<Cart, "subtotal" | "currency">) { /*...*/ }
   ```

These are the practical TS forms of "depend only on what you use."

### Q6. *"Refactor this code."*
```ts
interface FileSystem {
  read(path: string): string;
  write(path: string, content: string): void;
  delete(path: string): void;
  watch(path: string, cb: (event: string) => void): void;
  zip(paths: string[]): Buffer;
  encrypt(path: string, key: string): void;
}
```

**Answer.** Split into roles — almost every consumer of a `FileSystem` only needs a slice:

```ts
interface FileReader   { read(path: string): string; }
interface FileWriter   { write(path: string, content: string): void; delete(path: string): void; }
interface FileWatcher  { watch(path: string, cb: (event: string) => void): void; }
interface FileArchiver { zip(paths: string[]): Buffer; }
interface FileCrypto   { encrypt(path: string, key: string): void; }

// Each client takes only the role(s) it needs
class ConfigLoader {
  constructor(private readonly fs: FileReader) {}
  /* ... */
}

class BackupRunner {
  constructor(private readonly fs: FileReader & FileArchiver) {}
  /* ... */
}
```

A concrete `LocalFileSystem` class can still implement all five interfaces. The win is at the *consumer* side: tests, mocks, and refactors only touch the roles they care about.

### Q7. *"Where does ISP push back against itself?"*

**Answer.** Same tension as SRP. Splitting too aggressively gives you "interface soup" — a maze of one-method interfaces that no longer feel like roles. The fix is to **always anchor to the role**: methods that the same client actually uses together belong together. If you can't name the role coherently (`UserReader` vs. `UserSomethingElseGetter`), you've over-split. Pull back.

### Q8 (bonus). *"Is ISP relevant in dynamic / structural type systems like TypeScript and Go?"*

**Answer.** Even more so. Both languages let a type satisfy *any* interface its shape matches — without `implements`. That makes role-based interfaces extremely cheap (just declare an interface; any class with the right methods auto-fits) and removes the ceremony Java/C# users complain about. Go's standard library is a celebration of ISP — `io.Reader`, `io.Writer`, `io.Closer` are tiny, composable interfaces, and almost every type implements only what it actually does. TypeScript inherits this advantage.

---

## Recap — what to remember

1. **ISP — clients shouldn't depend on methods they don't use.** Many small interfaces, not one giant one.
2. The classic smell: a subclass that **throws "not implemented"** or has empty no-ops.
3. Split by **role**, not by method. A role is a coherent capability used by one kind of client.
4. **ISP often prevents LSP violations from existing.** A wide interface is what makes a refused-bequest possible.
5. In TypeScript, the practical tools are **multiple `implements`**, **intersection types (`A & B`)**, and **`Pick` / `Omit`**.
6. **Don't over-segregate.** One-method interfaces for everything is interface soup. Anchor to roles.

---

## What's next
Lesson 14 — **SOLID: D — Dependency Inversion Principle.** The capstone of SOLID. You've already practiced it (DI in Lesson 08 was the *implementation*); now we'll formalize the principle and see how all five SOLID rules interlock into a single design philosophy.
