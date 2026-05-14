# Lesson 02 — Interfaces & Abstract Classes

> **Phase 1 — TypeScript for LLD**
> The two ways to declare contracts. Choosing the right one is half of LLD design.

---

## 1. Concept / Theory

In LLD, you constantly need to say:

> *"This thing must be able to do X. I don't care **how** it does X — I just need to call it."*

That sentence is the definition of a **contract**. TypeScript gives you two ways to write contracts:

1. **`interface`** — a pure shape description. Zero implementation. Zero runtime cost.
2. **`abstract class`** — a contract **plus** some shared implementation that subclasses inherit.

### Interface — the pure contract

```ts
interface PaymentMethod {
  pay(amount: number): Promise<PaymentResult>;
  refund(transactionId: string): Promise<void>;
}
```

- An interface describes **what** without ever specifying **how**.
- It vanishes at compile time — there is no `interface PaymentMethod {}` at runtime.
- A class can `implement` many interfaces (multiple inheritance of contract).
- You can have interfaces of objects too — not just classes (`interface User { id: string }`).

### Abstract class — partial implementation

```ts
abstract class PaymentProcessor {
  // shared, concrete behavior — every subclass gets this for free
  protected log(msg: string) { console.log(`[payment] ${msg}`); }

  // template method — uses the abstract bits below
  async process(amount: number): Promise<PaymentResult> {
    this.log(`processing ${amount}`);
    const result = await this.charge(amount);
    this.log(`done: ${result.status}`);
    return result;
  }

  // abstract = "subclass MUST implement this"
  protected abstract charge(amount: number): Promise<PaymentResult>;
}
```

- An abstract class **cannot be instantiated** directly (`new PaymentProcessor()` is an error).
- It can have **concrete methods** (shared logic), **abstract methods** (must be implemented by subclasses), and **fields**.
- A class can `extend` only **one** abstract class.

### The interview-defining table

| Question                              | `interface`                                   | `abstract class`                              |
| ------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| Can it have implementation?           | No (only types)                               | Yes (some methods can be concrete)            |
| Can it have state (fields with values)? | No (declarations only)                      | Yes                                           |
| Multiple inheritance?                 | Yes — `class C implements A, B`               | No — `extends` only one                       |
| Compile-time only?                    | Yes — disappears at runtime                   | No — exists at runtime                        |
| Can it have a constructor?            | No                                            | Yes (called by subclass via `super()`)        |
| Use when…                             | You only care about **shape**                 | You want **shared code** + a contract         |

### TypeScript's structural typing — the surprise

This is the interview gotcha for anyone coming from Java/C#:

```ts
interface Duck { quack(): void; }

class Person {
  quack() { console.log("I am a person pretending to quack"); }
}

const d: Duck = new Person(); // ✅ works! No "implements Duck" needed.
```

In Java this would fail. In TypeScript, **shapes are compared structurally** — if it walks like a duck and quacks like a duck, it's a duck. You don't have to declare `implements`. The `implements` keyword is just a *check*, not a *requirement*.

**Why this matters for LLD:** structural typing makes mocking, testing, and adapting third-party code much easier — but it also means you can accidentally satisfy a contract you didn't intend to. Be deliberate about the shape of your interfaces.

---

## 2. Real-life Analogy

**Interface = a job description.**
"Wanted: Pizza Delivery Person. Must have a vehicle. Must accept addresses. Must return delivery time."

The job description doesn't say *how* to do the job. Anyone — bicycle rider, motorcyclist, drone — who matches the description can apply.

**Abstract class = an apprenticeship program.**
"Train as a Pizza Delivery Person. We'll teach you how to read a map, communicate with the kitchen, and handle payments. **You** decide how to physically deliver — bike, car, scooter — but everything else, we provide."

You inherit a partial skillset, and you're required to fill in the rest before you graduate (= can be instantiated).

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — using inheritance when an interface would do

```ts
// ❌ BAD: forcing inheritance for "shape" requirements
abstract class Loggable {
  abstract log(message: string): void;
}

class FileWriter extends Loggable {
  log(message: string) { /* write to file */ }
}

class S3Uploader extends Loggable {
  log(message: string) { /* upload to S3 */ }
}

// Now FileWriter can't extend any other base class because TS allows only one extends.
// We just burned our single-inheritance budget on "must have a log method".
```

**Why it fails:**
- `Loggable` has no shared implementation — it has *only* an abstract method. That's exactly what an interface is for.
- Single-inheritance is a precious resource; spending it on a contract is wasteful.
- We've coupled subclasses to a class hierarchy that gives them nothing in return.

### Bad pattern B — duplicating logic across siblings

```ts
// ❌ BAD: copy-pasted retry logic in every payment processor
class StripeProcessor {
  async charge(amount: number) {
    for (let i = 0; i < 3; i++) {
      try { return await this.actualStripeCall(amount); }
      catch (e) { if (i === 2) throw e; }
    }
  }
  private actualStripeCall(amount: number) { /* ... */ }
}

class RazorpayProcessor {
  async charge(amount: number) {
    for (let i = 0; i < 3; i++) {       // ← same retry loop
      try { return await this.actualRazorpayCall(amount); }
      catch (e) { if (i === 2) throw e; }
    }
  }
  private actualRazorpayCall(amount: number) { /* ... */ }
}
```

**Why it fails:**
- Same retry loop copied. Bug fixes have to be applied N times.
- A new processor must remember the convention. Easy to forget the retry.
- This is exactly what abstract classes solve via the **Template Method** pattern.

---

## 4. Good Code (the right way)

### Pattern A — use `interface` for pure contracts

```ts
// ✅ GOOD
interface Loggable {
  log(message: string): void;
}

interface Persistable {
  save(): Promise<void>;
}

// A class can satisfy multiple interfaces — no inheritance budget burned
class AuditEvent implements Loggable, Persistable {
  log(message: string) { /* ... */ }
  async save() { /* ... */ }
}
```

### Pattern B — use `abstract class` when there's shared behavior

```ts
// ✅ GOOD: shared retry logic lives in the base, subclasses fill in the actual call
abstract class PaymentProcessor {
  protected readonly maxRetries = 3;

  // template method — defines the algorithm skeleton
  async charge(amount: number): Promise<PaymentResult> {
    for (let i = 0; i < this.maxRetries; i++) {
      try { return await this.doCharge(amount); }
      catch (e) {
        if (i === this.maxRetries - 1) throw e;
        await this.delay(2 ** i * 100); // exponential backoff
      }
    }
    throw new Error("unreachable");
  }

  private delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  // subclass-only API — concrete classes plug in the vendor call
  protected abstract doCharge(amount: number): Promise<PaymentResult>;
}

class StripeProcessor extends PaymentProcessor {
  protected async doCharge(amount: number): Promise<PaymentResult> {
    return await stripeSdk.charges.create({ amount });
  }
}

class RazorpayProcessor extends PaymentProcessor {
  protected async doCharge(amount: number): Promise<PaymentResult> {
    return await razorpaySdk.payments.create({ amount });
  }
}
```

This is the **Template Method** design pattern — we'll meet it again later, but you've already used it.

### Pattern C — combine both

```ts
// Contract for the outside world
interface PaymentProcessor {
  charge(amount: number): Promise<PaymentResult>;
}

// Shared implementation for our internal vendors
abstract class BaseVendorProcessor implements PaymentProcessor {
  async charge(amount: number) { /* retry skeleton, calls doCharge */ }
  protected abstract doCharge(amount: number): Promise<PaymentResult>;
}

class StripeProcessor extends BaseVendorProcessor {
  protected async doCharge(amount: number) { /* stripe call */ }
}

// A wallet credit isn't a vendor — it doesn't need retry logic
class WalletCreditProcessor implements PaymentProcessor {
  async charge(amount: number) { /* deduct from wallet, no retries */ }
}
```

This is a very common LLD layout: **interface = the public contract, abstract class = a convenient shared base, concrete classes = the actual implementations.** Callers depend on the interface, never on the abstract class.

---

## 5. Real-world Use Cases

- **Express middleware** — `(req, res, next) => void` is an *implicit* interface. Any function matching the shape is a middleware.
- **React component types** — `React.FC<Props>` is a structural type. Any function with the right signature is a component.
- **Node `Stream` classes** — `Readable`, `Writable`, `Transform` are abstract classes. They give you `pipe`, `on`, backpressure handling for free; you only implement `_read` / `_write`.
- **NestJS `CanActivate`** — an interface for guards: `canActivate(ctx): boolean`. Many implementations — JWT, Roles, RateLimit — none of them share implementation, so it's purely a contract.
- **TypeORM `BaseEntity`** — abstract class that gives subclasses methods like `save()`, `remove()`, `find()`. Subclasses just declare columns; CRUD comes for free.
- **Strategy pattern** in any payment system: `interface PaymentStrategy { pay() }` with concrete `UpiStrategy`, `CardStrategy`, `WalletStrategy`. We'll build this in a later lesson.

---

## 6. Interview Questions (with answers)

### Q1. *"When would you choose an interface over an abstract class, and vice versa?"*

**Answer.** Use an **interface** when:
- You only need to describe a shape — no shared implementation.
- A class might already extend something else (multiple interfaces are fine; multiple `extends` is not).
- You want a stable public API that any module can satisfy without inheriting from your class hierarchy.

Use an **abstract class** when:
- There is genuine shared logic (template method, default behavior, common state) you don't want to copy-paste.
- You need a constructor, fields with default values, or `protected` helpers.
- All implementations are conceptually "the same kind of thing" — `BaseVendorProcessor` siblings, `Animal` subclasses.

A useful rule of thumb: **start with an interface**. Promote to an abstract class only when you find yourself copy-pasting the same code into every implementation.

### Q2. *"What's structural typing, and how is it different from nominal typing?"*

**Answer.** TypeScript checks types **by shape**, not by name. Two unrelated types with the same shape are interchangeable:

```ts
interface Point2D { x: number; y: number; }
interface Vector2 { x: number; y: number; }
const p: Point2D = { x: 1, y: 2 };
const v: Vector2 = p;  // ✅ — same shape, even though names differ
```

Java/C# use **nominal** typing: the *name* of the type matters, even if shapes match. Structural typing is more flexible (great for mocks, adapters, ad-hoc objects) but means you can accidentally satisfy a contract you didn't intend. To opt into nominal-like behavior in TS, use **branded types**:

```ts
type UserId = string & { __brand: "UserId" };
type OrderId = string & { __brand: "OrderId" };
// Now UserId and OrderId are not interchangeable even though both are strings.
```

### Q3. *"Can an interface extend a class? Can a class implement another class?"*

**Answer.** Yes to both, and both are surprising.

- **`interface I extends C` (class as a base)** — the interface inherits the *type* of the class (its public + protected + private members) but not its implementation. Sometimes used to define "the shape of class X without depending on its impl."
- **`class A implements B` (class as a contract)** — TS treats class `B` as just a type definition for this purpose. You'll get an error if `A` doesn't have all of `B`'s public members. Rarely useful — usually a sign you should have extracted an interface.

Don't bring these up unless the interviewer asks; just know they're legal.

### Q4. *"Why doesn't this code compile?"*
```ts
interface Animal { name: string; }
class Dog implements Animal {
  constructor(public name: string, public breed: string) {}
}
function printAnimal(a: Animal) { console.log(a.name); }

const d: Animal = { name: "Rex", extra: "oops" };  // ❌
```

**Answer.** TS uses **excess property checking** for *fresh object literals* assigned to a type. Even though structural typing would normally allow extra properties, when you create a literal directly and assign it to a typed slot, TS rejects unknown keys. The fix is either:
- assign through a variable: `const o = { name: "Rex", extra: "oops" }; const a: Animal = o;` (passes — no longer "fresh")
- widen the interface or use `as Animal` (but then you lose the safety check, so prefer fixing the literal)

This trips up almost everyone in interviews when they discuss interfaces.

### Q5. *"What is the Template Method pattern, and how does it relate to abstract classes?"*

**Answer.** Template Method is a behavioral design pattern: an abstract class defines the **skeleton** of an algorithm in a public method, delegating specific steps to abstract methods that subclasses implement. The skeleton is fixed; the steps vary.

Example:
```ts
abstract class ReportGenerator {
  generate(): string {
    return this.header() + "\n" + this.body() + "\n" + this.footer();
  }
  protected header() { return `Report — ${new Date().toISOString()}`; }
  protected footer() { return `--- end of report ---`; }
  protected abstract body(): string;
}

class SalesReport extends ReportGenerator {
  protected body() { return "total sales: $42,000"; }
}
```
Abstract classes are the *natural* home for Template Method because you need both shared concrete code (the skeleton) and abstract slots (the steps). It's one of the few cases where reaching for an abstract class is clearly the right move.

### Q6 (bonus). *"Can you have static methods on an interface?"*

**Answer.** No. Interfaces describe instance shapes; they have no runtime presence. If you need a "static" contract — say, every class must have a `fromJSON` factory — you describe the **constructor type**:

```ts
interface SerializableCtor<T> {
  new(): T;
  fromJSON(s: string): T;
}
function load<T>(ctor: SerializableCtor<T>, json: string): T {
  return ctor.fromJSON(json);
}
```

Niche but occasionally asked.

---

## Recap — what to remember

1. **Interface = shape**, **abstract class = shape + shared code**.
2. Default to interfaces. Reach for abstract classes only when shared implementation appears.
3. A class implements many interfaces but extends one (abstract or concrete) class.
4. TS is **structurally typed** — `implements` is a check, not a requirement. Use branded types if you need nominal behavior.
5. The classic LLD layout: **interface for the public contract → abstract class for shared base → concrete classes for the actual work.** Callers depend on the interface only.
6. Template Method (skeleton + abstract steps) is the killer use case for abstract classes.

---

## What's next
Lesson 03 — **Inheritance & Polymorphism**: how `extends` and `super` actually work, runtime polymorphism, method overriding rules, and when inheritance starts hurting more than helping.
