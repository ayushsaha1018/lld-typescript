# 33 — Clean Code Principles

> Phase 5 — Clean Code
> Source-of-truth: Robert C. Martin's "Clean Code," Kent Beck's "Smalltalk Best Practice Patterns"
> Audience: code that another engineer (or reviewer) will read in 6 months

---

## 1. Why this matters in an LLD interview

In an LLD round, interviewers are watching three things:

1. **Did you pick reasonable patterns?** (Lessons 16–32.)
2. **Did you express the design clearly in code?** (This lesson.)
3. **Could you explain trade-offs?** (Lesson 34 + the LLD problems.)

Pattern knowledge is necessary but not sufficient. A `class Order extends BaseService` with `doStuff()` and 200-line methods will lose points even if the architecture is technically sound. The same design with clear names, small functions, and obvious responsibility boundaries reads as senior.

A useful framing: **clean code is code that fits in your head.** Each function expresses one idea. Each class has one purpose. The vocabulary of names matches the vocabulary of the domain.

---

## 2. The principles, with code

### 2.1 Naming — the single highest-leverage habit

> "There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton

Bad names quietly poison everything else. Good names mean fewer comments, fewer bugs, faster reviews.

Rules of thumb:

* **Reveal intent.** A name should tell you *why* something exists, not just *what* it is.
* **Avoid disinformation.** Don't call a `Map` a `list`. Don't call something `account_list` if it's a `Set`.
* **Pronounceable, searchable.** `genymdhms` is unsearchable. `generationTimestamp` is.
* **One word per concept.** Pick `fetch` or `get` or `load` — not all three.
* **Solution-domain or problem-domain.** Use `JobQueue` if it's a queue (CS term). Use `Account` if it's the business concept. Don't mix.

```ts
// ❌ unclear
function check(d: any[], t: number): any[] {
  return d.filter(x => x.s > t);
}

// ✅ self-documenting
function findActiveOrdersAboveThreshold(
  orders: Order[],
  minTotal: number,
): Order[] {
  return orders.filter(o => o.total > minTotal && o.status === "active");
}
```

The second version doesn't need a comment.

**Booleans should read like predicates.** `isActive`, `hasPermission`, `canRefund`, `shouldRetry`. Never `flag`, `mode`, `state` for a boolean.

**Functions should read like verbs**: `fetchUser`, `sendEmail`, `applyDiscount`. **Classes should read like nouns**: `Order`, `PaymentGateway`, `LoggerFactory`.

---

### 2.2 Small functions, single purpose

A function should do **one thing** at **one level of abstraction**.

The rough heuristic: **if the function does X *and* Y, split it.** If you read it and find yourself summarizing it as "first it does A, then it does B, then C," those should probably be three functions called from one.

```ts
// ❌ does too much
async function processOrder(order: Order) {
  // 1) validate
  if (!order.items.length) throw new Error("empty order");
  for (const item of order.items) {
    if (item.qty <= 0) throw new Error("bad qty");
  }
  // 2) compute total
  let total = 0;
  for (const item of order.items) total += item.qty * item.price;
  if (order.coupon) total *= (1 - order.coupon.percent / 100);
  // 3) charge
  const result = await stripe.charge(order.userId, total);
  if (!result.ok) throw new Error("payment failed");
  // 4) save
  await db.orders.insert({ ...order, total, paidAt: new Date() });
  // 5) notify
  await mailer.send(order.userEmail, "Order confirmed", `Total: ${total}`);
  return order.id;
}

// ✅ each step is its own function; processOrder reads as a story
async function processOrder(order: Order): Promise<string> {
  validateOrder(order);
  const total = computeTotal(order);
  await charge(order.userId, total);
  await persistOrder(order, total);
  await sendConfirmation(order.userEmail, total);
  return order.id;
}
```

The second `processOrder` reads top-to-bottom like a paragraph. Each step is a verb at the same level of abstraction. To dive deeper, you read the helpers — but the high-level intent is captured in five lines.

**Stepdown rule** — a corollary: in a file, each function calls only functions one level lower. Reading top-to-bottom, you descend one level of detail at a time. This makes navigation through unfamiliar code natural.

**Size rule of thumb**: 5–15 lines for most functions. Hard cap at ~30 unless there's a really good reason. If a function won't fit on a screen, it's almost certainly two functions.

---

### 2.3 Separation of concerns — different reasons to change

This is SRP from the OO world, restated for the function and module level. A piece of code should be responsible for *one thing*, where "one thing" is defined as one *reason to change*.

A common mixed-concern smell:

```ts
// ❌ HTTP, business logic, and DB access mixed in one method
class OrderController {
  async createOrder(req: Request, res: Response) {
    const userId = req.headers["user-id"];
    if (!userId) return res.status(401).send("unauth");
    const items = req.body.items;
    let total = 0;
    for (const i of items) total += i.qty * i.price;
    if (total < 0) return res.status(400).send("bad total");
    const result = await db.orders.insert({ userId, items, total });
    return res.status(201).json({ id: result.id });
  }
}

// ✅ each layer has its own responsibility
class OrderService {                 // business logic
  async create(userId: string, items: Item[]): Promise<{ id: string }> {
    const total = computeTotal(items);
    if (total < 0) throw new ValidationError("total");
    return this.repo.insert({ userId, items, total });
  }
  constructor(private repo: OrderRepository) {}
}

class OrderController {              // HTTP concern only
  async createOrder(req: Request, res: Response) {
    try {
      const userId = req.user.id;
      const result = await this.service.create(userId, req.body.items);
      res.status(201).json(result);
    } catch (e) {
      mapErrorToResponse(e, res);
    }
  }
  constructor(private service: OrderService) {}
}

class OrderRepository {              // data access only
  async insert(o: Omit<Order, "id">) { return db.orders.insert(o); }
}
```

The clean version has three reasons to change, one per class:

1. HTTP / API contract changes → `OrderController`.
2. Business rules change → `OrderService`.
3. Database / storage changes → `OrderRepository`.

Each can be tested, mocked, or replaced independently.

---

### 2.4 Don't build God Classes

A **God Class** is one that knows about every part of the system: 30+ methods, 200+ lines, depends on 10+ other classes. It accumulates because "new behavior always feels like it belongs here."

Symptoms:

* The class name is generic — `Manager`, `Helper`, `Util`, `Service`, `Processor`.
* Method names are heterogeneous — `sendEmail`, `calculateInterest`, `parseCSV`, `generateReport`.
* Tests for the class need to set up half the universe.
* Any change has a non-trivial chance of touching this class.

Fix: **split by responsibility**. Group methods by what they actually do, extract each group into its own class.

```ts
// ❌ god class
class UserService {
  createUser() {} signIn() {} signOut() {} hashPassword() {}
  sendWelcomeEmail() {} sendPasswordReset() {} validateEmail() {}
  exportToCSV() {} importFromCSV() {}
  trackPageView() {} recordSignupEvent() {}
}

// ✅ separated
class AuthService     { signIn() {} signOut() {} hashPassword() {} }
class UserAccountService { createUser() {} updateUser() {} }
class UserMailer      { sendWelcomeEmail() {} sendPasswordReset() {} }
class EmailValidator  { validate() {} }
class UserCSVPort     { export() {} import() {} }
class UserAnalytics   { trackPageView() {} recordSignupEvent() {} }
```

Each class is now small, testable, and *boring* — which is what you want.

---

### 2.5 Avoid tight coupling — depend on abstractions

When module A imports concrete class B and `new`'s it up, A is welded to B. Replacing B becomes a refactor across A.

```ts
// ❌ tight coupling
class OrderService {
  private mailer = new SendGridMailer();   // welded
  async create(order: Order) {
    // ...
    await this.mailer.send(order.email, "Confirmed", "...");
  }
}

// ✅ depend on an interface; injection point
interface Mailer { send(to: string, subj: string, body: string): Promise<void>; }

class OrderService {
  constructor(private mailer: Mailer) {}
  async create(order: Order) {
    await this.mailer.send(order.email, "Confirmed", "...");
  }
}
```

Now `OrderService` works with any `Mailer` — SendGrid, SES, in-memory test fake. This is the practical face of *Dependency Inversion* (Lesson 14).

The rule: **classes should depend on the abstractions they use, not the concrete classes that supply them.**

---

### 2.6 Avoid magic numbers and strings

Hardcoded values are unsearchable, unexplained, and easy to drift.

```ts
// ❌ magic
if (user.role === "admin") { /* ... */ }
setTimeout(refresh, 86400000);

// ✅ named
const ADMIN_ROLE = "admin";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (user.role === ADMIN_ROLE) { /* ... */ }
setTimeout(refresh, ONE_DAY_MS);
```

For role / status / kind values, prefer **enums or string-literal unions**:

```ts
type Role = "admin" | "editor" | "viewer";
```

The compiler now catches typos and exhaustive switches; the IDE autocompletes valid values.

---

### 2.7 Comments — write them for why, not what

The "what" should be obvious from the code (good naming + small functions). Comments earn their place when they explain *why* something is the way it is — context the code itself can't carry.

```ts
// ❌ noise — restates the code
i = i + 1; // increment i

// ❌ outdated — likely lies
// returns the user's age in years
function age(u: User): number { return Date.now() - u.dob.getTime(); }

// ✅ explains a non-obvious reason
// Stripe rate-limits us at 100 rps. We enforce a smaller local limit
// to leave headroom for retries.
const MAX_RPS = 80;

// ✅ tells the reader about external constraints
// IE11 fires this twice on the same click — debounce protects us.
const onClick = debounce(handleClick, 50);
```

If a comment exists to explain a confusing function, the *function* is the bug. Rename or refactor first; if the comment is still needed, it's now genuinely about *why*, not *what*.

**Avoid commented-out code.** Delete it; git remembers.

---

### 2.8 Error handling — explicit, not "swallow and pray"

A few rules for error handling that read as senior:

1. **Throw for exceptional conditions, return values for expected outcomes.** Don't throw `NotFoundError` on a `findUser` that "might not find" — return `User | null` (or `Result<User, Error>`).
2. **Don't swallow errors silently.** A bare `catch (e) {}` is almost always wrong; at minimum log, ideally re-throw or wrap.
3. **Distinguish error *types*.** A `ValidationError` is different from a `DBConnectionError` is different from a `ProgrammerError`. Map them to behaviors (400 vs 503 vs alert).
4. **Use `try/finally` for resources.** Whatever happens, the connection closes / the transaction rolls back.
5. **Errors carry context.** `Error("not found")` is useless. `Error("user 4231 not found while updating profile")` is useful.

```ts
// ❌ swallow and pray
try { await charge(card, amt); } catch {}

// ❌ catch + log + carry on as if nothing happened
try { await charge(card, amt); }
catch (e) { console.log(e); }

// ✅ classify and propagate
try { await charge(card, amt); }
catch (e) {
  if (e instanceof InsufficientFundsError) throw new UserFacingError("declined");
  if (e instanceof RateLimitError) throw new RetryableError("upstream rate limited");
  throw e;   // unknown — let it bubble up
}
```

In TS specifically, **avoid `any` in catch blocks.** TS 4.4+ defaults to `unknown`; embrace it. Narrow with `instanceof` checks.

---

### 2.9 DRY, KISS, YAGNI — but watch the dosage

Three timeless principles, each with a failure mode if applied dogmatically.

* **DRY (Don't Repeat Yourself).** Two pieces of code that change for the same reason should be one piece. *Failure mode*: extracting "duplication" that's only superficial — two classes that look similar but encode different concepts. Premature abstraction is worse than duplication.
* **KISS (Keep It Simple).** The simplest design that solves the actual problem. *Failure mode*: oversimplifying past the point of correctness; or skipping abstractions that the system genuinely needs.
* **YAGNI (You Aren't Gonna Need It).** Don't build for hypothetical future needs. *Failure mode*: ignoring extensibility that's genuinely on the roadmap.

The unifying meta-principle: **build for what you know; refactor when you learn more.** Patterns and abstractions earn their place when there's *real* multiplicity, *real* extension pressure, *real* repetition. Prematurely adding them creates ceremony.

In interviews, when asked "would you add X here?" the senior answer often is: "Not yet. I'd add it the day we have a second use case." That's YAGNI in action and demonstrates you don't reach for ceremony.

---

### 2.10 Side effects: minimize and contain

A function that returns a value *and* writes a file *and* sends an email *and* mutates an argument is a debugging nightmare. Whenever possible:

* **Pure functions where possible** — same input, same output, no side effects.
* **Side effects pushed to the edges** — the controller / service layer does I/O; the core domain logic is pure.
* **Mutations made obvious** — name them `update`, `set`, `apply`. A function named `calculatePrice` should not silently mutate the order.

```ts
// ❌ surprises
function calculatePrice(order: Order): number {
  order.total = order.items.reduce((s, i) => s + i.price, 0);  // mutates!
  if (order.total > 1000) sendDiscountEmail(order);            // side-effect!
  return order.total;
}

// ✅ pure
function calculatePrice(order: Order): number {
  return order.items.reduce((s, i) => s + i.price, 0);
}

// caller decides what to do with the result
const total = calculatePrice(order);
order = { ...order, total };
if (total > 1000) await sendDiscountEmail(order);
```

In React/Redux work, this is the same instinct as "reducers are pure." Push side effects to thunks, sagas, or effect hooks.

---

## 3. Code review mental checklist

When you re-read your own LLD code (or someone else's), run through this:

1. Are class and function names *nouns* and *verbs* respectively, in the domain language?
2. Does each function do one thing at one level of abstraction?
3. Could I cover this class with a sentence: "This is responsible for X"? If "X" is multi-clause, you have multiple responsibilities.
4. Are dependencies *injected* or `new`'d up internally?
5. Are there magic strings/numbers I should name?
6. Are errors classified, or all caught generically?
7. Are side effects either pure-pushed-to-the-edges or obviously named?
8. Are there comments that should be code? Could a rename or extraction kill the comment?
9. Are there obvious duplications that hide a missing abstraction? (Three or more is the threshold; two is a coincidence.)
10. Would a new teammate be able to navigate this in 10 minutes?

If you answer "yes" honestly to all ten, the code is clean. The first 1–2 you fail on are usually where the most leverage is.

---

## 4. Interview Questions

### Q1. What does Clean Code mean to you?

**Answer:** Clean code is code that's easy to *read* and *change* by someone other than the author. The two most important properties:

1. **It fits in your head.** Each function expresses one idea at one level of abstraction. You can read it top-to-bottom and understand intent without dipping into implementation details.
2. **It's honest.** Names match what the code actually does. Comments are about *why*, not *what*. Functions and classes have boundaries that match real-world responsibilities.

The tactical practices flow from those: small functions, intention-revealing names, separation of concerns, dependency injection, contained side effects, classified errors. None of those are end goals; they're consequences of optimizing for readability and changeability.

In an interview, I'd add: clean code matters *most* in LLD because LLD is about expressing a design clearly. Two candidates might pick the same patterns; the one whose code is cleaner gets the offer.

---

### Q2. How do you decide when a function is too long?

**Answer:** A few heuristics:

1. **It does more than one thing.** If I can summarize its body as "first it does A, then B, then C," those should probably be separate functions.
2. **It mixes levels of abstraction.** A function that has both `if (account.balance > limit)` and `db.query("SELECT ...")` is at two levels. Pull the SQL into a method named after its intent (`fetchOverdueAccounts`).
3. **It exceeds ~30 lines.** Not a hard rule, but past 30 lines you almost always have a multi-purpose function.
4. **Tests for it require a complex setup.** If a single function needs 10 lines of mock setup, it's doing too much.

The fix is almost always **extract method**: name a coherent block of code, lift it out, replace it with the call. Often the original function becomes 5 lines that read like a story, with the helpers each doing one thing.

---

### Q3. How do you handle errors in TypeScript?

**Answer:** A few habits:

1. **Distinguish expected from exceptional.** "User not found" might be expected (return `null` or `Result`); "DB connection lost" is exceptional (throw).
2. **Throw typed errors.** Subclass `Error` for `ValidationError`, `NotFoundError`, `RateLimitError`. The catcher can `instanceof`-check and decide.
3. **`unknown` over `any` in catch.** TS 4.4+ defaults to this. Narrow before using.
4. **Map domain errors at the boundary.** A `ValidationError` becomes a 400 in the HTTP layer, not in the service. The domain doesn't know it's behind HTTP.
5. **Add context.** `throw new Error(\`failed to update user ${id}: ${e}\`)` is more useful than re-throwing the bare error.
6. **Use `try/finally` for resources.** Or, better, use scope-bound resources (the `using`/`Symbol.dispose` proposal in TS 5.2+).

The bigger principle: **treat errors as part of the type signature.** If a function can fail in two distinct ways, the caller should know — either via thrown subclasses, a `Result<T, E>` type (with libraries like neverthrow), or explicit nullables.

---

### Q4. What's the DRY trap?

**Answer:** DRY is right *when the duplication represents one concept*. The failure mode is extracting an abstraction over duplication that *looks* the same but represents *different* concepts.

Classic example: two endpoints both build a `User` response with `id`, `name`, `email`. Looks like duplication. But if one is the public profile response and the other is the admin-tool response, they're different concepts that *happen* to share fields right now. Extract a shared `UserDTO` and the day admin needs to expose `lastLogin` (which public must not), you have a tangled mess.

The rule of three: **wait for three duplications before extracting**. Two is a coincidence; three suggests a real concept.

A famous Sandi Metz line: *"Duplication is far cheaper than the wrong abstraction."* If you're ever unsure, leave it duplicated. You can extract later when the shared concept is clearer. Un-extracting a wrong abstraction is far more painful.

---

### Q5. How do you avoid your code becoming a mess as the project grows?

**Answer:** A few habits, in roughly priority order:

1. **Naming is a first-class concern.** I rename things during code review and during refactors. Bad names compound.
2. **Boundaries between layers stay strict.** Controllers don't talk to DBs; services don't know about HTTP. Each layer has one reason to change.
3. **I refactor in small steps as I go**, not in big quarterly cleanups. The Boy Scout Rule: leave the campsite cleaner than you found it. Touching a class to add a feature → also tighten one rough edge.
4. **Tests anchor refactoring.** Without tests, refactoring is gambling. With tests, it's safe.
5. **I delete code aggressively.** Unused code rots; commented-out code lies. Git remembers everything; trust it.
6. **I push side effects to the edges.** The core stays pure and easy to reason about; I/O lives in well-known boundary classes.
7. **I'm comfortable with duplication as a stepping stone.** Better one rough cut today than the wrong abstraction baked in.
8. **I listen to pain.** A class that keeps showing up in every PR is asking to be split. A function that needs a comment to read is asking to be renamed/extracted. Those signals are the system telling me what to refactor next.

---

## TL;DR Cheat Sheet

```
Naming:
  - Classes are nouns; functions are verbs; booleans are predicates.
  - Reveal intent. No magic numbers/strings.
  - Pick one word per concept.

Functions:
  - 5–15 lines is the sweet spot; rarely > 30.
  - Do one thing at one level of abstraction.
  - Stepdown rule: each function calls one level lower.

Classes / Modules:
  - One reason to change (SRP).
  - Depend on abstractions, not concretes (DI).
  - Watch for god classes; split by responsibility.

Errors:
  - Classify (typed Errors); don't swallow.
  - `unknown` over `any` in catch.
  - Add context; map at the layer boundary.

Comments:
  - Explain WHY, not WHAT. Code carries the WHAT.
  - Delete commented-out code. Git remembers.

Side effects:
  - Pure core; I/O at the edges.
  - Mutations named obviously (update/set).

DRY / KISS / YAGNI — apply with judgment:
  - DRY: real duplication, one concept. Wait for three.
  - KISS: simplest design that meets actual needs.
  - YAGNI: don't build for hypothetical futures.

Code review checklist:
  1. Names domain-aligned?           6. Errors classified?
  2. One thing per function?         7. Side effects contained?
  3. Class summarizable in 1 line?   8. Comments explain why?
  4. Dependencies injected?          9. Real duplications extracted?
  5. Magic values named?             10. Navigable in 10 minutes?

Interview gold: "I treat naming as a first-class concern, push side
                 effects to edges, and extract abstractions only after
                 three duplications. Better one rough cut today than
                 the wrong abstraction baked in."
```
