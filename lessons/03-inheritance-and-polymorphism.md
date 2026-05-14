# Lesson 03 — Inheritance & Polymorphism

> **Phase 1 — TypeScript for LLD**
> Inheritance is how subclasses reuse their parent. Polymorphism is how callers stop caring which subclass they got. Together they're the engine that lets LLD code stay extensible.

---

## 1. Concept / Theory

### Inheritance — `extends`
Inheritance lets a class **reuse and specialize** another class. The child gets all of the parent's public + protected members, and can override or add to them.

```ts
class Animal {
  constructor(public name: string) {}
  speak(): string { return "some sound"; }
}

class Dog extends Animal {
  speak(): string { return `${this.name} says woof`; }
}
```

- `extends` creates an **"is-a"** relationship — `Dog` *is an* `Animal`.
- A class can extend **only one** parent (single inheritance — the same constraint we hit in Lesson 02).
- The child must call `super()` in its constructor before using `this` if the parent has a constructor.

### `super` — two distinct uses

```ts
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);  // 1) call parent constructor
    this.name = "HttpError";
  }
}

class TimeoutError extends HttpError {
  constructor() {
    super(408, "Request timed out");
  }

  describe(): string {
    return super.toString() + " (timed out)";  // 2) call parent method
  }
}
```

Two roles for `super`:
1. In a constructor: `super(args)` — invoke the parent constructor.
2. In a method: `super.methodName(args)` — invoke the parent's version of an overridden method.

### Method overriding
A child redefines a method the parent already defined. The signature should be **compatible** (TS checks this).

```ts
class Notifier {
  send(msg: string): void { console.log(msg); }
}

class EmailNotifier extends Notifier {
  send(msg: string): void {
    super.send(`[email] ${msg}`); // delegate up
  }
}
```

> Use the **`override` keyword** (TS 4.3+) and enable `noImplicitOverride` in `tsconfig.json`. Then if the parent renames `send`, your `EmailNotifier.send` becomes a *new* method instead of silently overriding nothing — the compiler will catch it. This is one of those "make-it-or-break-it" config flags in real codebases.

```ts
class EmailNotifier extends Notifier {
  override send(msg: string): void { /* ... */ }
}
```

### Polymorphism — same call, different behavior
**Polymorphism** literally means "many shapes". In OOP it means: **a single piece of code can work with objects of different concrete types as long as they share a common type.**

```ts
function broadcast(notifiers: Notifier[], msg: string) {
  for (const n of notifiers) n.send(msg);
}

broadcast(
  [new EmailNotifier(), new SmsNotifier(), new SlackNotifier()],
  "Build is green",
);
```

`broadcast` doesn't know or care what concrete type each `Notifier` is. At runtime, JavaScript dispatches `n.send(msg)` to whichever class actually owns the object. This is **runtime polymorphism** — and it's the single most powerful tool in LLD.

> "Method overloading" in the C++/Java sense (multiple methods with the same name but different parameter lists) doesn't really exist in JS/TS. TS has *type-level* overloads but only one implementation. We'll cover this in the FAQ at the bottom.

### Why polymorphism is the heart of LLD
Almost every LLD design pattern — **Strategy**, **State**, **Observer**, **Command**, **Template Method**, **Decorator** — is a particular *shape* of polymorphism. Once you see "this for-loop calls a method on a base type", you've seen the whole game.

---

## 2. Real-life Analogy

Think of how you operate a TV with a **remote control**.

You press the "power" button — and you don't think about how the power button maps to a Sony, an LG, or an Onida internally. The remote (caller) treats every TV (object) as "a thing with a power button" (interface / base class). Each TV implements the button differently, but to you they're interchangeable.

Now — if a new brand comes out tomorrow, do you change the remote? No. As long as the new TV has a power button, the remote keeps working. **That's the win** — adding a new subclass doesn't require changing existing callers. This is **the Open/Closed Principle**, which we'll cover formally in Phase 2 — but you've just felt it.

---

## 3. Bad Code (what NOT to do)

### Bad pattern — fan-out via `if/else` instead of polymorphism

```ts
// ❌ BAD: caller has to know every concrete type
type Shape = { kind: "circle" | "square" | "triangle"; /* dimensions */ } & Record<string, number>;

function area(shape: Shape): number {
  if (shape.kind === "circle") {
    return Math.PI * shape.radius * shape.radius;
  } else if (shape.kind === "square") {
    return shape.side * shape.side;
  } else if (shape.kind === "triangle") {
    return 0.5 * shape.base * shape.height;
  }
  throw new Error("unknown shape");
}
```

**Why it fails:**
1. Adding a new shape (`pentagon`) means **editing** `area`. Every caller that branches on `kind` must also be updated. This is a **shotgun-surgery** code smell.
2. The "shape" data is type-soup — every shape has all possible fields as `number | undefined`.
3. Tests for `area` have a long, branching cyclomatic complexity.
4. There's no compile-time check that you handled every shape.

### Bad pattern — overusing inheritance to share unrelated code

```ts
// ❌ BAD: Employee extends Database because we wanted DB helpers
class Database {
  protected query(sql: string) { /* ... */ }
}

class Employee extends Database {
  hire(name: string) {
    this.query(`INSERT INTO emp ...`);
  }
}
```

Here inheritance is being used as **scope-stealing**, not as an *is-a* relationship. An `Employee` is **not** a `Database`. We've now got:
- `Employee` is testable only when a real DB is available.
- Two classes can never share the helpers if both must extend something else.
- The class hierarchy tells future readers a lie about the domain.

The right answer is *composition* (`new Employee(db: Database)`) — which is exactly Lesson 04.

---

## 4. Good Code (the right way)

### Polymorphic `Shape`

```ts
// ✅ GOOD: each subclass owns its own area() — caller is shape-agnostic
abstract class Shape {
  abstract area(): number;
}

class Circle extends Shape {
  constructor(private readonly radius: number) { super(); }
  override area(): number { return Math.PI * this.radius ** 2; }
}

class Square extends Shape {
  constructor(private readonly side: number) { super(); }
  override area(): number { return this.side * this.side; }
}

class Triangle extends Shape {
  constructor(private readonly base: number, private readonly height: number) { super(); }
  override area(): number { return 0.5 * this.base * this.height; }
}

// caller knows nothing about kinds
function totalArea(shapes: Shape[]): number {
  return shapes.reduce((sum, s) => sum + s.area(), 0);
}
```

What changed:
- **Adding `Pentagon` requires zero changes** to `Shape`, `Circle`, `Square`, `Triangle`, or `totalArea`. You just write a new class.
- Each class owns its data and its formula. No sprawling `if/else`.
- `area` is a 1-line method per shape — trivially testable.
- The compiler enforces every concrete shape to implement `area`.

### Polymorphic notification

```ts
abstract class Notifier {
  abstract send(userId: string, msg: string): Promise<void>;
}

class EmailNotifier extends Notifier {
  override async send(userId: string, msg: string) { /* SES call */ }
}
class SmsNotifier extends Notifier {
  override async send(userId: string, msg: string) { /* Twilio */ }
}
class PushNotifier extends Notifier {
  override async send(userId: string, msg: string) { /* FCM */ }
}

class NotificationService {
  constructor(private readonly channels: Notifier[]) {}

  async notifyAll(userId: string, msg: string) {
    await Promise.all(this.channels.map(c => c.send(userId, msg)));
  }
}

// At wire-up time:
const svc = new NotificationService([
  new EmailNotifier(),
  new SmsNotifier(),
  new PushNotifier(),
]);
```

`NotificationService` doesn't care which channels exist. Tomorrow we add `WhatsAppNotifier` and pass it in — zero changes to `NotificationService`. This is the most common LLD pattern in interviews.

### Calling `super` to extend, not replace

```ts
abstract class Logger {
  log(msg: string): void { console.log(`[${new Date().toISOString()}] ${msg}`); }
}

class FileLogger extends Logger {
  override log(msg: string): void {
    super.log(msg);                  // keep the timestamped console line
    fs.appendFileSync("app.log", msg); // and also write to file
  }
}
```

The `super.log(msg)` call is the polite way to *extend* the parent's behavior instead of fully replacing it.

---

## 5. Real-world Use Cases

- **Error hierarchies in Node libs**: `Error → HttpError → 404NotFound, 500InternalError`. Callers `catch (e: Error)` and switch on `instanceof` only when needed. Express, Axios, and NestJS all use this.
- **DOM events**: every event is an `Event` subclass — `MouseEvent`, `KeyboardEvent`, `TouchEvent`. `addEventListener` doesn't know which one will fire.
- **React class components (legacy)**: `class MyComponent extends React.Component` — `render`, `componentDidMount`, etc., are methods you override.
- **Game enemies**: `Enemy → Goblin, Dragon, Zombie`. `update(deltaTime)` and `render(ctx)` are polymorphic — the engine just iterates `enemies.forEach(e => e.update(dt))`.
- **Database connection pools**: `Connection → MySqlConnection, PgConnection`. Higher-level code calls `conn.query(sql)` regardless.
- **Strategy / State / Observer patterns**: every behavioral pattern in Phase 4 is polymorphism in a costume. (Promise.)

---

## 6. Interview Questions (with answers)

### Q1. *"What's the difference between method overriding and method overloading? Does TS support both?"*

**Answer.**
- **Overriding** — a child class redefines a method the parent already has. Same name, same signature. The child's version runs at runtime when called on a child instance. TS supports this fully (and the `override` keyword makes it explicit).
- **Overloading** in the Java/C++ sense — multiple methods with the same name but different parameter lists, all coexisting at runtime. **TS does not support this**, because JS has only one method per name. TS does support **type-level overloads**: you can declare multiple call signatures, but you must implement them with a *single* function body.

```ts
class Geometry {
  area(radius: number): number;                       // overload signature
  area(width: number, height: number): number;        // overload signature
  area(a: number, b?: number): number {                // single implementation
    return b === undefined ? Math.PI * a * a : a * b;
  }
}
```

This is a frequent gotcha for candidates from Java/C# backgrounds.

### Q2. *"Can a private member of the parent be accessed in the child?"*

**Answer.** No. `private` means *this class only*. If you want children to access it, mark it `protected`. Quick reminder of the visibility ladder we covered in Lesson 01:

| Modifier   | Same class | Subclass | Outside |
|------------|------------|----------|---------|
| `public`   | ✅          | ✅        | ✅       |
| `protected`| ✅          | ✅        | ❌       |
| `private`  | ✅          | ❌        | ❌       |

A common bug: parent has `private cache`, child needs to invalidate it on a related event, child can't reach `cache` — refactor parent to `protected cache` (or, better, expose a `protected invalidateCache()` method so the field stays private).

### Q3. *"What does `override` do in TypeScript, and why should I enable `noImplicitOverride`?"*

**Answer.** `override` is a keyword the child uses to declare "I am intentionally overriding a parent method". With `noImplicitOverride: true` in tsconfig, the compiler enforces it everywhere — and crucially, if the parent renames or removes the method, the child's `override` errors loudly: *"this method does not override anything"*. Without it, the child's method silently becomes a brand-new method, and the polymorphic dispatch you expected is gone — production bug, no warning. Enabling `noImplicitOverride` is one of the cheapest reliability wins in a TS codebase.

### Q4. *"Why might inheritance be a bad choice even when the 'is-a' relationship technically holds?"*

**Answer.** A few reasons:
1. **Inheritance is rigid.** A class extends one parent forever. If your domain changes — `Employee` was an `Person` but now needs `Worker` mixins — you're stuck.
2. **Subclasses are coupled to the parent's internals.** Add a private field to the parent, and any child reading it from `protected` access can break. This is the **fragile base class** problem.
3. **Behavior reuse via inheritance hides the dependency.** When `Employee extends Database`, the `Database` dependency is hidden inside the chain. Composition (`new Employee(db)`) makes it explicit and testable.
4. **Polymorphism doesn't *need* inheritance.** It needs *interfaces*. Two unrelated classes that both implement `Notifier` are polymorphic without sharing any parent.

The general guidance: **prefer composition over inheritance** — Lesson 04 will hammer this.

### Q5. *"What's the Liskov Substitution Principle, in plain words?"*

**Answer.** Anywhere code expects a `Bird`, you should be able to pass a `Sparrow` and have everything still work. Subclasses must honor the contract their parent established — same input expectations, same output guarantees. The classic violation is the **Square / Rectangle** trap:

```ts
class Rectangle {
  constructor(public width: number, public height: number) {}
  setWidth(w: number) { this.width = w; }
  setHeight(h: number) { this.height = h; }
}

class Square extends Rectangle {
  override setWidth(w: number) { this.width = w; this.height = w; }   // sneaky
  override setHeight(h: number) { this.width = h; this.height = h; }
}

function grow(r: Rectangle) {
  r.setWidth(5);
  r.setHeight(10);
  console.log(r.width * r.height);   // expects 50; if r is a Square, gets 100
}
```

Mathematically a square *is a* rectangle. Behaviorally, in this API, it's not — passing a `Square` violates the caller's expectations. LSP is one of the SOLID principles; we'll deep-dive in Phase 2.

### Q6. *"In TypeScript, can I have multiple inheritance via `extends`?"*

**Answer.** No — a class extends exactly one class. If you need behavior from multiple sources, you have two options:
1. **Multiple interfaces** (`class C implements A, B, D`) — fine for *contracts*, but you must implement them all.
2. **Mixins** — a TS pattern where you compose a class from multiple "mixin" functions that each add behavior. They're a workaround, not a feature; in interviews mention them only if asked. The cleaner answer for sharing behavior is composition (Lesson 04).

---

## Recap — what to remember

1. **Inheritance is "is-a" + reuse.** A subclass gets the parent's public+protected members and can override.
2. **`super` does two jobs**: call the parent constructor, or call the parent's version of an overridden method.
3. **Polymorphism is the actual win.** Callers depend on a base type; new subclasses extend without modifying old code.
4. **Use `override` + `noImplicitOverride`** — enable it project-wide. Free reliability.
5. **Prefer interfaces for polymorphism** — don't inherit just to share a method shape.
6. **LSP**: a subclass must be substitutable for its parent without breaking caller assumptions. Square/Rectangle is the canonical violation.
7. **Inheritance has costs** — fragile base class, single-parent limit, hidden dependencies. When in doubt, compose.

---

## What's next
Lesson 04 — **Composition vs Inheritance**: the famous Duck/RobotDuck refactor, the *favor composition over inheritance* mantra, and the day-to-day decision rule for picking one or the other.
