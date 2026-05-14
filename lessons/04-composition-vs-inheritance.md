# Lesson 04 — Composition vs Inheritance

> **Phase 1 — TypeScript for LLD**
> The single most important judgment call in OO design. Get this right and most of your "should I make this an abstract class?" questions answer themselves.

---

## 1. Concept / Theory

You have two ways to give a class behavior it doesn't natively own:

### Inheritance — *is-a*
Reuse code by **extending** a parent class. The child *becomes* a kind of the parent.
```ts
class Dog extends Animal { /* inherits speak(), eat() */ }
```
- Locked in at compile time.
- Single-parent only.
- Subclass shares the parent's internals (the **fragile base class** problem).

### Composition — *has-a*
Reuse code by **holding** another object and delegating to it. The class *uses* the other object's behavior.
```ts
class Car {
  constructor(private engine: Engine, private gps: Gps) {}
  start() { this.engine.start(); }
  navigate(to: string) { this.gps.routeTo(to); }
}
```
- Wired up at runtime — you can pass a different `Engine` for testing, swap a `MockGps`, etc.
- A class can hold as many collaborators as it wants.
- The collaborators don't know who's holding them — clean decoupling.

### The mantra
> **"Favor composition over inheritance."**
> — *Design Patterns* (Gang of Four), 1994. Still true in 2026.

This isn't a ban on inheritance. It's a **default**. Use inheritance when there is a genuine *is-a* relationship **and** the parent's contract is stable. Otherwise, compose.

### The classic decision rule
Ask two questions:

1. **"Is the relationship truly *is-a* — meaning every method of the parent makes sense on the child, forever?"** If you hesitate, it's not is-a.
2. **"Will the child's behavior need to change at runtime, or come in many configurable variants?"** If yes, composition (a strategy held as a field) is far more flexible.

If you answer "no" to (1) or "yes" to (2) → **compose**.

### Why composition wins in modern code
- **Testability.** You inject mocks for collaborators. With inheritance, you have to subclass and override — heavier ceremony.
- **Flexibility.** Behavior can change without recompiling — pass a different collaborator at construction time.
- **Multiple sources of behavior.** A class can compose many helpers; it can only extend one parent.
- **Clear dependencies.** `constructor(private gps: Gps)` is a billboard saying "I depend on a Gps". Inheritance hides that fact.
- **Less rigid hierarchy.** Adding a feature doesn't force you to reshape the class tree.

---

## 2. Real-life Analogy

### Inheritance — adopting a parent's full identity

You're born into a family of locksmiths. You inherit *every* technique, *every* tool, *every* superstition. If the family has a rule like "we never work on Tuesdays" — you inherit that too. To change anything, you'd have to rebel against the lineage.

### Composition — hiring specialists

You start a business. You **hire** a locksmith for locks, a plumber for plumbing, an electrician for wiring. Each is a separate professional you bring in. If the locksmith retires, you hire another one. If you change businesses tomorrow, you keep your roster of specialists or swap them out as needed.

That second model is how big systems actually grow — with **composed specialists**, not a single inherited identity. It's also why microservices, dependency injection, and service-oriented architectures all rest on composition at their core.

---

## 3. Bad Code (what NOT to do) — the Duck Disaster

This is the canonical example from *Head First Design Patterns*, in TypeScript.

```ts
// ❌ BAD: every duck inherits fly(). Even rubber ducks.
abstract class Duck {
  abstract display(): void;
  quack(): void { console.log("Quack!"); }
  swim(): void { console.log("All ducks swim."); }
  fly(): void { console.log("I'm flying!"); }
}

class MallardDuck extends Duck {
  display() { console.log("I'm a real mallard"); }
}

class RedheadDuck extends Duck {
  display() { console.log("I'm a redhead"); }
}

// New requirement: rubber duck
class RubberDuck extends Duck {
  display() { console.log("I'm a rubber duck"); }
  override quack() { console.log("Squeak!"); }   // ok, override
  override fly() { /* ... uh ... */ }            // ❌ rubber ducks can't fly
}

// New requirement: decoy duck (wooden, doesn't fly, doesn't quack)
class DecoyDuck extends Duck {
  display() { console.log("I'm a decoy"); }
  override quack() { /* silent */ }
  override fly() { /* nope */ }
}
```

**Why it fails:**
1. **`fly()` was added to `Duck` because *most* ducks fly.** But "most" is not "all". Now every non-flying duck has to **override-with-empty** — a code smell screaming *the inheritance is wrong*.
2. Tomorrow product wants `RocketDuck extends Duck`. We'd override `fly()` again. And the next variant. The class hierarchy grows wider with every special case.
3. Behavior is **fixed at compile time**. A `MallardDuck` can never decide at runtime to stop flying.
4. Two ducks that fly the same way (e.g. real mallard, real swan) can't share that exact `fly` implementation — they'd both have it inherited from `Duck`, but if only *some* ducks fly that way, the only escape is a *deeper* hierarchy: `FlyingDuck → MallardDuck`, `NonFlyingDuck → RubberDuck`. Now we have inheritance gymnastics, and we still haven't solved the core problem: **`fly` is a varying behavior, and inheritance treats it as fixed.**

---

## 4. Good Code (the right way) — the Composition Refactor

We pull the varying behaviors (`fly`, `quack`) **out of the inheritance hierarchy** and hand them in as **interchangeable strategies** that the duck *has* — not *is*.

```ts
// ✅ GOOD: behaviors are pluggable, not inherited
interface FlyBehavior {
  fly(): void;
}

interface QuackBehavior {
  quack(): void;
}

// Concrete fly strategies
class FlyWithWings implements FlyBehavior {
  fly() { console.log("Flying with wings!"); }
}
class FlyNoWay implements FlyBehavior {
  fly() { /* don't even try */ }
}
class FlyRocketPowered implements FlyBehavior {
  fly() { console.log("Whoosh — rocket-powered flight!"); }
}

// Concrete quack strategies
class StandardQuack implements QuackBehavior {
  quack() { console.log("Quack!"); }
}
class Squeak implements QuackBehavior {
  quack() { console.log("Squeak!"); }
}
class MuteQuack implements QuackBehavior {
  quack() { /* silence */ }
}

// Duck holds (composes) its behaviors instead of inheriting them
abstract class Duck {
  constructor(
    protected flyBehavior: FlyBehavior,
    protected quackBehavior: QuackBehavior,
  ) {}

  abstract display(): void;
  swim() { console.log("All ducks swim."); }

  performFly()  { this.flyBehavior.fly(); }
  performQuack() { this.quackBehavior.quack(); }

  // 💡 runtime behavior swap — impossible with inheritance
  setFlyBehavior(fb: FlyBehavior) { this.flyBehavior = fb; }
}

class MallardDuck extends Duck {
  constructor() { super(new FlyWithWings(), new StandardQuack()); }
  display() { console.log("I'm a real mallard"); }
}

class RubberDuck extends Duck {
  constructor() { super(new FlyNoWay(), new Squeak()); }
  display() { console.log("I'm a rubber duck"); }
}

class DecoyDuck extends Duck {
  constructor() { super(new FlyNoWay(), new MuteQuack()); }
  display() { console.log("I'm a decoy"); }
}

// New: rocket duck — zero changes to existing code
class ModelDuck extends Duck {
  constructor() { super(new FlyNoWay(), new StandardQuack()); }
  display() { console.log("I'm a model duck"); }
}

const m = new ModelDuck();
m.performFly();                      // doesn't fly
m.setFlyBehavior(new FlyRocketPowered());
m.performFly();                      // 🚀 now it does
```

What this buys us:

| Before (inheritance)                     | After (composition)                                     |
| ---------------------------------------- | ------------------------------------------------------- |
| `fly` is one behavior, fixed at class    | `fly` is many behaviors, swappable per duck             |
| Adding `RocketDuck` reshapes hierarchy   | Adding rocket flight = one new `FlyBehavior` class      |
| Override-with-empty for non-flyers       | Just compose with `FlyNoWay`                            |
| Cannot change behavior at runtime        | `setFlyBehavior(...)` works any time                    |
| Test: must subclass to fake behavior     | Test: pass a `FakeFlyBehavior` in constructor           |

**This is also the Strategy Pattern**, which we'll cover formally in Phase 4. You've now seen its mechanics three lessons before its name. Patterns are just well-named compositions.

### A second example — testability

```ts
// ❌ BAD — Employee inherits from Database to "get DB methods"
class Database {
  protected query(sql: string) { /* real DB call */ }
}
class Employee extends Database {
  hire(name: string) { this.query(`INSERT INTO emp ...`); }
}

// You cannot test Employee.hire() without a real DB.
// You'd have to subclass: class TestEmployee extends Employee { override query() {...} } — gross.
```

```ts
// ✅ GOOD — Employee composes a Database
interface Database { query(sql: string): Promise<unknown>; }

class Employee {
  constructor(private readonly db: Database) {}
  async hire(name: string) {
    await this.db.query(`INSERT INTO emp (name) VALUES ('${name}')`);
  }
}

// In production:
const emp = new Employee(realPgDatabase);
// In tests:
const emp = new Employee({ query: async () => undefined });   // trivial mock
```

The composed version is testable, swappable, and honest about what it depends on.

---

## 5. When inheritance IS the right choice

Composition is the default — but inheritance has its place:

1. **True is-a with stable contract.** `class HttpError extends Error` — every `HttpError` *is* an `Error`, the contract is fixed, and we get `.message`, `.stack`, `.toString()` for free. Fine.
2. **Template Method pattern (Lesson 02).** When you genuinely want a *fixed skeleton* with overridable steps, an abstract class is the cleanest expression.
3. **Framework-imposed base classes.** React class components, NestJS exception filters, TypeORM `BaseEntity` — when the framework requires you to extend, you extend.
4. **Closed, well-known taxonomies.** A small, stable set of types you control (`AstNode → ExpressionNode, StatementNode`) — inheritance models the taxonomy clearly.

If your case doesn't match one of these, default to composition.

---

## 6. Real-world Use Cases

- **React hooks** are a giant move from inheritance (`extends Component`) to composition (`useState`, `useEffect`, `useCustomHook`). Each hook is a small, composable behavior — exactly the lesson of this chapter.
- **Express / Koa / NestJS middlewares** are composed: `app.use(logger).use(auth).use(rateLimit)`. Adding behavior = composing one more middleware, not subclassing the framework.
- **Redux reducers / NgRx**: state behavior is composed from small reducers, not inherited from a giant `BaseReducer`.
- **AWS Lambda layers + handlers**: composition of capabilities into a function.
- **Game engines (Unity ECS / Bevy)**: full move away from inheritance (`Player extends MovableEnemy extends GameObject`) to **Entity-Component-System** — components are composed onto entities; no class tree.
- **NestJS dependency injection**: every service receives its collaborators via constructor injection. The framework is built on composition; inheritance is the exception.

If you take one line away from this lesson: **modern frameworks, modern languages, and modern interview questions all reward composition.**

---

## 7. Interview Questions (with answers)

### Q1. *"Why is composition usually preferred over inheritance?"*

**Answer.** Four reasons:
1. **Flexibility** — composed dependencies can be swapped at runtime; inherited ones are baked in at compile time.
2. **Testability** — you mock by injecting a fake; you don't have to subclass and override.
3. **Multi-source reuse** — you can compose many helpers; you can extend only one class.
4. **Clear dependencies** — composition makes "this class depends on X" visible in the constructor; inheritance hides dependencies inside the class chain.

The deeper reason: inheritance creates a **rigid contract for forever**, while composition creates a **flexible contract for now**. Software changes; the flexible contract wins long-term.

### Q2. *"Walk me through a time you'd refactor inheritance into composition."*

**Answer (use Duck or your own example).** "When I see a base class with a method that more than one subclass overrides with an empty or alternate implementation — that's a signal the behavior is *varying*, not *fixed*. The fix is to extract that method into a small interface (`FlyBehavior`), make several concrete strategies (`FlyWithWings`, `FlyNoWay`), and have the base class hold one as a field. Each concrete subclass picks which strategy to wire up. As a bonus, behavior becomes runtime-swappable, which is impossible with inheritance."

### Q3. *"What is the fragile base class problem?"*

**Answer.** When changing a parent class breaks unrelated subclasses. Examples:
- Parent adds a private field that conflicts with one a child relied on by name.
- Parent slightly changes the order of two protected method calls inside a public method — children that overrode one but not the other now misbehave.
- Parent changes a method's contract (e.g., now throws on negative input). Every child relying on the old contract is silently wrong.

This is one reason teams get nervous about deep inheritance. With composition, the analogous risk is much smaller because the relationship is at the *interface boundary*, not deep in the parent's implementation.

### Q4. *"Is using `implements` (interfaces) the same as inheritance?"*

**Answer.** No. `implements` only declares *"this class promises to satisfy this shape"*. There is no behavior reuse — the class still has to implement everything itself. So `implements` is a **contract**, not inheritance. You can `implements` many interfaces without burning your single-`extends` budget. In LLD, the common pairing is: depend on **interfaces** for polymorphism, depend on **composition** for behavior reuse, and use **`extends`** only for clear is-a / template-method cases.

### Q5. *"Refactor this code."*
```ts
class HttpClient {
  protected request(url: string) { /* fetch + retry + logging */ }
}
class GitHubClient extends HttpClient {
  getRepo(name: string) { return this.request(`/repos/${name}`); }
}
class GitLabClient extends HttpClient {
  getProject(id: string) { return this.request(`/projects/${id}`); }
}
```

**Answer.** GitHubClient and GitLabClient aren't really *kinds of* HttpClient — they *use* an HttpClient. Refactor to composition:

```ts
interface HttpClient { request(url: string): Promise<Response>; }

class FetchHttpClient implements HttpClient {
  async request(url: string) { /* fetch + retry + logging */ }
}

class GitHubClient {
  constructor(private readonly http: HttpClient) {}
  getRepo(name: string) { return this.http.request(`/repos/${name}`); }
}
class GitLabClient {
  constructor(private readonly http: HttpClient) {}
  getProject(id: string) { return this.http.request(`/projects/${id}`); }
}
```

Now `GitHubClient` and `GitLabClient` can each be tested with a mock `HttpClient`, neither owns its single-inheritance budget, and we could swap `FetchHttpClient` for `AxiosHttpClient` without changing GitHub/GitLab code.

### Q6. *"When would you still pick inheritance?"*

**Answer.** When the relationship is genuinely *is-a* and the contract is stable: `HttpError extends Error`, AST nodes, framework-required base classes (`React.Component`, NestJS `Filter`s), or a clean Template Method skeleton. Also: if the inheritance is *one level deep*, owned by you, and the parent is small and unlikely to change — the friction is low and the readability win can be real. Avoid inheritance trees more than 2-3 levels deep; that's where the fragile-base-class problems compound.

---

## Recap — what to remember

1. **Composition (has-a) is the default.** Inheritance (is-a) is a special case.
2. The Duck/RobotDuck refactor: any **varying behavior** should be a *strategy you hold*, not a *method you override*.
3. Composition gives you: runtime swappability, easy mocking, multiple-source reuse, explicit dependencies.
4. Inheritance still wins for: genuine is-a, stable contracts, Template Method skeletons, framework-imposed base classes.
5. **Patterns are just well-named compositions.** Strategy, Decorator, Adapter, State, Observer — every one of them composes objects with interfaces. You'll feel right at home in Phase 4.

---

## What's next
Lesson 05 — **Generics**: how to write classes and functions that work for *any* type while keeping full type safety. The `Repository<T>` pattern, generic constraints, and the interview pitfalls.
