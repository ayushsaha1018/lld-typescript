# Lesson 09 — The Four Pillars of OOP

> **Phase 2 — OOP & SOLID** · *Lesson 1 of 6*
> Encapsulation, Abstraction, Inheritance, Polymorphism. Phase 1 taught you the *mechanics* — this lesson formalizes the *principles* behind them, in the language interviewers use.

---

## 1. Concept / Theory

Object-Oriented Programming rests on four pillars. They aren't TypeScript features — they're **design ideas** that any OO language gives you tools to express. Knowing them lets you talk about your designs in shared vocabulary, which is what an LLD interview really tests.

### Pillar 1 — Encapsulation
*"Hide what changes; expose what's stable."*

Bundle data and the methods that act on it together, and **prevent the outside world from poking at internal state**. The class becomes a fortress: you knock at a method, and the class decides whether to open the door.

- The **fortress wall** is your access modifiers (`private`, `protected`).
- The **doors** are your public methods.
- The **rules in the fortress** are your invariants (`balance ≥ 0`, `email is valid`).

### Pillar 2 — Abstraction
*"Speak the language of intent, not implementation."*

A class — or an interface — exposes a small, **purposeful** API and hides the messy details behind it. When you call `notifier.send(msg)`, you don't know or care whether it's email, SMS, push, or a guy with a megaphone. **The shape of the API is the abstraction.**

> **Encapsulation hides _state_. Abstraction hides _complexity_.**
> They are easily confused — the difference matters in interviews.

### Pillar 3 — Inheritance
*"Specialize an existing thing without rewriting it."*

A subclass takes everything its parent declares and either reuses or refines it. Inheritance gives you a free reuse mechanism — but, as we hammered in Lessons 03 and 04, it's the most rigid kind of reuse. Use it when the relationship is genuinely **is-a** and the parent contract is stable.

### Pillar 4 — Polymorphism
*"Same call, different behavior — chosen at runtime."*

A method call on a base type dispatches to the **actual** concrete type at runtime. You can write code against `Notifier`, and tomorrow add `WhatsAppNotifier` and the existing code keeps working unchanged.

This is the engine that makes most design patterns possible. Without polymorphism, Strategy / State / Decorator / Observer don't exist.

### How they relate

| Pillar          | What it gives you                                  | Lesson where you saw it |
| --------------- | -------------------------------------------------- | ----------------------- |
| Encapsulation   | Safe state, enforced invariants                    | 01                      |
| Abstraction     | Stable API surface; swappable implementations      | 02                      |
| Inheritance     | Reuse + specialization                             | 03                      |
| Polymorphism    | Open-ended extensibility (Open/Closed Principle)   | 03                      |

The four pillars **work together**: you encapsulate state in a class, define the abstraction (interface) it satisfies, allow subclasses to specialize via inheritance, and call them polymorphically. SOLID — coming up — is a set of rules for *how* to use these four pillars well.

---

## 2. Real-life Analogy

A **car** is the textbook OO analogy:

- **Encapsulation:** the engine is locked under the hood. You can't rummage inside while the car is running. The car exposes a steering wheel, pedals, gear lever — that's the "public API". The "internal state" — fuel mixture, ignition timing, transmission fluid temperature — is hidden.
- **Abstraction:** when you press the brake, you don't think *brake fluid → master cylinder → calipers → friction → kinetic energy → heat*. You just think "stop." The pedal is the abstraction; the hydraulic system is the implementation.
- **Inheritance:** an `ElectricCar` *is a* `Car`. It inherits steering, brakes, seats, pedals. It specializes the powertrain. You don't redesign the steering wheel because the engine changed.
- **Polymorphism:** a parking-lot system swipes a wheel sensor and reads "this is a car of length 4.2m." It charges parking fees. It doesn't care whether the engine is petrol, diesel, or electric. Same call (`car.length`), correct behavior for each.

You touch all four every time you drive. They're not abstract academic ideas — they're how complex systems stay manageable.

---

## 3. Bad Code (what NOT to do)

A code review of one class violating all four pillars at once.

```ts
// ❌ BAD: mauls every pillar simultaneously
class TaskManager {
  // Encapsulation violated — everything public, mutable
  tasks: { id: number; title: string; done: boolean; createdAt: Date }[] = [];
  nextId = 1;

  // Abstraction violated — caller has to think about how things are stored
  addTask(title: string) {
    this.tasks.push({ id: this.nextId++, title, done: false, createdAt: new Date() });
  }

  // No inheritance — duplicated logic in EmailTaskManager and CalendarTaskManager elsewhere
  // (because we couldn't structure the hierarchy to share)

  // Polymorphism violated — caller branches on a "type" field, instead of dispatching
  notify(taskIndex: number, channel: string) {
    const t = this.tasks[taskIndex];
    if (channel === "email") {
      // ... email logic
    } else if (channel === "sms") {
      // ... sms logic
    } else if (channel === "push") {
      // ... push logic
    }
  }
}

// caller code
const tm = new TaskManager();
tm.tasks.push({ id: 999, title: "hacked", done: true, createdAt: new Date() }); // 😱
tm.nextId = 1;                                  // resets the counter
tm.notify(0, "email");                          // string-typed channel — typos welcome
```

What's wrong, pillar by pillar:

| Pillar        | Violation here                                                                       |
| ------------- | ------------------------------------------------------------------------------------ |
| Encapsulation | `tasks` and `nextId` public; consumers can corrupt the model                         |
| Abstraction   | `addTask` exposes implementation (`push` to an array; raw Date) instead of intent    |
| Inheritance   | Could have had `BaseTaskManager` with shared logic; doesn't                          |
| Polymorphism  | `notify` does `if/else` on `channel` — should dispatch on a `Notifier` strategy      |

Most "junior" code looks like this in some way. Senior code applies all four pillars to remove that pile-up.

---

## 4. Good Code (the right way)

We refactor the same module so each pillar earns its keep.

### 4.1 Encapsulation — protect the state

```ts
// ✅ Encapsulation: state private, mutations through methods
class TaskList {
  private readonly items: Task[] = [];
  private nextId = 1;

  add(title: string): Task {
    if (!title.trim()) throw new Error("title required");
    const task: Task = { id: this.nextId++, title, done: false, createdAt: new Date() };
    this.items.push(task);
    return task;
  }

  complete(id: number): void {
    const t = this.items.find(t => t.id === id);
    if (!t) throw new Error(`no task ${id}`);
    t.done = true;
  }

  list(): readonly Task[] {
    return this.items;       // returned as readonly view
  }
}

interface Task {
  id: number;
  title: string;
  done: boolean;
  createdAt: Date;
}
```

`items`, `nextId`, validation rules — all internal. Consumers can only do what `add`, `complete`, and `list` allow.

### 4.2 Abstraction — define the interface

```ts
// ✅ Abstraction: define WHAT, not HOW
interface Notifier {
  send(userId: string, message: string): Promise<void>;
}
```

Code that uses `Notifier` knows only the *shape*. It doesn't know whether the implementation queues to Kafka, calls Twilio, or prints to a file.

### 4.3 Inheritance — share the spine where it makes sense

```ts
// ✅ Inheritance: shared retry logic in a base, subclasses fill the actual call
abstract class BaseNotifier implements Notifier {
  async send(userId: string, message: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try { return await this.deliver(userId, message); }
      catch { if (i === 2) throw new Error("delivery failed"); }
    }
  }

  protected abstract deliver(userId: string, message: string): Promise<void>;
}

class EmailNotifier extends BaseNotifier {
  protected async deliver(userId: string, msg: string) { /* SES call */ }
}
class SmsNotifier extends BaseNotifier {
  protected async deliver(userId: string, msg: string) { /* Twilio */ }
}
class PushNotifier extends BaseNotifier {
  protected async deliver(userId: string, msg: string) { /* FCM */ }
}
```

Inheritance earns its keep here because there is *real* shared behavior (the retry skeleton — the **Template Method** pattern from Lesson 02).

### 4.4 Polymorphism — dispatch, don't branch

```ts
// ✅ Polymorphism: caller doesn't care which concrete notifier is here
class NotificationService {
  constructor(private readonly channels: Notifier[]) {}

  async notifyAll(userId: string, msg: string) {
    await Promise.all(this.channels.map(c => c.send(userId, msg)));
  }
}

// Composition root
const svc = new NotificationService([
  new EmailNotifier(),
  new SmsNotifier(),
  new PushNotifier(),
]);
```

Tomorrow we add `WhatsAppNotifier`. We make a new class. We append to the array. **Zero changes to `NotificationService`** — that's the **Open/Closed Principle**, which we'll formalize in Lesson 11.

### Putting them together

```
state (encapsulated in TaskList)
   ↓
contract (abstraction: Notifier interface)
   ↓
shared spine (inheritance: BaseNotifier with retry)
   ↓
runtime dispatch (polymorphism: NotificationService.notifyAll)
```

Each pillar adds one capability. Skip one and the whole chain weakens.

---

## 5. Real-world Use Cases

- **React component model.** Components encapsulate state (`useState`), expose a stable abstraction (the props/render contract), historically inherited from `React.Component`, and are used polymorphically (a parent renders a child that *happens* to be `Button` or `Link` or anything that satisfies the same prop shape).
- **AWS S3 SDK.** `S3Client` encapsulates connection state. `getObject`, `putObject` are abstractions over HTTP requests. Subclasses or wrappers add caching, retries. Polymorphic interfaces (`Storage`) let you swap S3 for GCS or local disk.
- **Typeorm / Prisma.** `BaseEntity` (inheritance) provides `save()`, `find()`. Each entity encapsulates its row. `Repository<T>` is the polymorphic abstraction.
- **Payment gateways at any e-commerce company.** A `PaymentMethod` interface (abstraction). Concrete `CardPayment`, `UpiPayment`, `WalletPayment` (polymorphism). Each encapsulates its API keys + retry rules. Often there's a `BaseCardPayment` shared base (inheritance).
- **Game engines.** Every `GameObject` encapsulates its state. They share `update(dt)` and `render(ctx)` contracts (abstraction). Inheritance trees model `Player → Wizard → IceWizard`. The render loop dispatches polymorphically.
- **Logger frameworks (Winston, Pino, log4js).** `Logger` interface, multiple `Transport` implementations, retry / formatting in a base — same four pillars.

When you see a clean, mature codebase, you'll find all four pillars working in concert. When you see a legacy mess, it's almost always because one or more pillars are missing.

---

## 6. Interview Questions (with answers)

### Q1. *"What's the difference between encapsulation and abstraction?"*

**Answer.** They're related but distinct:

- **Encapsulation** is about **information hiding** — keeping state private, controlling who can change it, enforcing invariants. Mechanism: access modifiers (`private`, `protected`).
- **Abstraction** is about **complexity hiding** — exposing a small purposeful API and concealing the messy implementation. Mechanism: interfaces, abstract classes, well-chosen public methods.

A handy phrasing: *encapsulation hides the **data**, abstraction hides the **work**.* You can have one without the other (a class can be encapsulated but expose an awful API), but the best code has both.

### Q2. *"Walk me through polymorphism with a real example. Why is it considered the 'engine' of OOP?"*

**Answer.** Polymorphism is the ability of a single piece of code to operate on objects of different concrete types via a common abstraction.

```ts
function broadcast(notifiers: Notifier[], msg: string) {
  for (const n of notifiers) n.send("u1", msg);   // dispatches per object's actual class
}
```

Why "engine":

- It is what enables the **Open/Closed Principle**: add new types without editing existing callers.
- It is what makes **design patterns** (Strategy, State, Observer, Command, Decorator) work — every behavioral pattern is shaped polymorphism.
- It's what frameworks like React, Express middleware, NestJS dispatching all rely on.

If you can only keep one OO concept in mind, polymorphism is it.

### Q3. *"Encapsulation just means 'private fields', right?"*

**Answer.** Not quite. Private fields are the **mechanism**, but encapsulation is the **goal** — *protecting invariants by controlling access.* You can have a class with all-private fields that still leaks state via getters/setters that don't enforce the invariants:

```ts
class Account {
  private _balance = 0;
  get balance() { return this._balance; }
  set balance(v: number) { this._balance = v; }   // breaks encapsulation
}
```

Mechanically private. Effectively public. Real encapsulation requires that **every change route through a method that enforces the rules**.

### Q4. *"When does inheritance break the four-pillar harmony?"*

**Answer.** When it's used for *code reuse* without a real *is-a* relationship — exactly the trap of Lesson 04. Symptoms:
- A subclass overrides a parent method with an empty body or alternate behavior (`fly() { /* rubber duck */ }`).
- Subclasses depend on protected fields that change beneath them (the **fragile base class** problem).
- Subclasses violate the parent's contract (LSP — Lesson 12).

When you see those, swap inheritance for composition (compose the behavior as a strategy) — you keep encapsulation, abstraction, and polymorphism intact, and you trade rigid inheritance for flexible has-a relationships.

### Q5. *"Why is information hiding (encapsulation) so important in large codebases?"*

**Answer.** Three reasons that compound:
1. **Refactoring safety.** Anything *not* exposed in the public API can be rewritten without breaking callers. With high public surface, refactors become risky and expensive.
2. **Invariant preservation.** Centralizing state mutation in a class means the rules ("balance never negative", "no duplicate emails") live in one place — you can prove them right by reading one file.
3. **Testability.** A small public API is a small surface to test. A class with everything public has an exponentially larger combinatorial surface.

The senior-engineer rule: **the public API is a contract; the private state is a free space**. Keep the public API small.

### Q6. *"Is overloading a form of polymorphism?"*

**Answer.** Sometimes called **ad-hoc polymorphism**, yes — but it's not the form OOP cares about. The polymorphism that matters in OOP is **subtype polymorphism**: the same call dispatches to different code based on the runtime type of the receiver. Method overloading is compile-time; the right method is chosen by the compiler based on arguments. In TS, "method overloading" doesn't even really exist — you can declare multiple type-level signatures but only one implementation. So when interviewers say "polymorphism," they mean *runtime subtype polymorphism* unless they explicitly ask about overloading.

### Q7. *"Give me a one-line summary of each pillar."*

**Answer.**
- **Encapsulation:** keep state private; expose behavior — invariants are enforced inside.
- **Abstraction:** describe *what* a thing does; hide *how*.
- **Inheritance:** specialize an existing class — `is-a` reuse.
- **Polymorphism:** the same call resolves to different behavior depending on the object's actual type.

Memorize these. They're the language of every LLD interview.

---

## Recap — what to remember

1. The four pillars are **Encapsulation, Abstraction, Inheritance, Polymorphism** — design principles, not language features.
2. **Encapsulation hides state. Abstraction hides complexity.** Two different jobs.
3. **Polymorphism is the engine** — everything Open/Closed and every behavioral pattern relies on it.
4. Inheritance has a smaller, more careful place than juniors think — use it for genuine *is-a* and stable contracts; otherwise compose.
5. The pillars work in concert: encapsulated state → abstract interfaces → optional shared spine via inheritance → polymorphic dispatch at the boundary.
6. **SOLID (next 5 lessons) is a rulebook for using these pillars well.**

---

## What's next
Lesson 10 — **SOLID: S — the Single Responsibility Principle**. The first and most-cited of the five rules. We'll see why "do one thing" is harder to define than it sounds, and how to spot SRP violations during a design interview.
