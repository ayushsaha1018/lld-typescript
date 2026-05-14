# Lesson 12 — SOLID: L — Liskov Substitution Principle

> **Phase 2 — OOP & SOLID** · *Lesson 4 of 6*
> The principle that explains why "a Square is-a Rectangle" can be true in math but wrong in code. The interview question that catches almost everyone.

---

## 1. Concept / Theory

### The original definition (Barbara Liskov, 1987)

> *"If for each object o₁ of type S there is an object o₂ of type T such that for all programs P defined in terms of T, the behavior of P is unchanged when o₁ is substituted for o₂, then S is a subtype of T."*

In one English sentence:

> **A subclass must be usable anywhere its parent is expected, without surprising the caller.**

If you pass a `Sparrow` where a `Bird` is expected, every program that uses `Bird` should keep working. If passing the `Sparrow` *changes* the program's behavior — throws an error, returns a wrong answer, breaks a contract — your subclass violates LSP.

### Behavioral subtyping — what subclasses must respect

LSP isn't satisfied just by matching the parent's *type signatures*. It requires the subclass to honor the parent's *contract* — the behavior callers depend on. There are three classical "rules":

| Rule | Plain version | Concrete example |
|------|---------------|------------------|
| **Pre-conditions cannot be strengthened** | The child cannot demand *more* than the parent did | If `Bird.fly(distance: number)` accepted any `distance > 0`, the child cannot demand `distance > 100` |
| **Post-conditions cannot be weakened** | The child cannot deliver *less* than the parent promised | If `findById` returns `User | undefined`, the child cannot return `null \| undefined \| User \| string` |
| **Invariants must be preserved** | The child must keep all the rules the parent guaranteed | If `Account.balance >= 0` always, the child must keep that true |

> An easier sloppy version: **the child should accept at least as much as the parent and promise at least as much.** "Be liberal in what you accept; be conservative in what you produce" — applied to subclasses.

A fourth "rule" worth knowing in advanced LLD:

- **History rule.** A subclass must not allow state changes that the parent forbade. (E.g., if `Point` is immutable, `MutablePoint extends Point` violates LSP because callers thought they had immutability.)

### The most useful test in practice

Apply this in code review:

> *Could I pass an instance of the subclass to **any** function written against the parent and expect it to behave correctly?*

If "no" — even in a corner case — your subclass is lying about being a substitute. LSP says: don't pretend.

### Why LSP matters

When LSP holds, **polymorphism stays trustworthy**. You can write `function ship(orders: Order[])` and not worry about which subclass is in the array — they all behave like `Order`s.

When LSP breaks, polymorphism becomes **booby-trapped**. The caller has to defensively check `instanceof` before doing anything — which is exactly the OCP violation we just escaped in Lesson 11. **LSP is what keeps OCP honest.**

### Common LSP-violation smells

1. A subclass overrides a method to **throw `UnsupportedOperationException`**. (a.k.a. **"refused bequest"**)
2. Callers do `if (x instanceof SpecificSubclass) ...` to handle a special case.
3. The parent has a public `set` method that the child secretly turns into a no-op.
4. The parent's documentation says "always returns a number"; the child sometimes returns null.
5. The subclass's tests look very different from the parent's tests for the same operation.

If you see any of these, you have an LSP problem — even if everything compiles.

---

## 2. Real-life Analogy

A **debit card** is a substitute for **cash** in most situations. You can pay at a shop, at a restaurant, online — anywhere cash is accepted, the debit card works. That's a clean LSP relationship: **debit-card *is-substitutable-for* cash**, callers (shops) don't change their workflow.

But consider a **gift card** that only works at one specific brand. Hand it to a coffee shop and the cashier rejects it. The gift card *looks* like a payment instrument and has the *type signature* of one — but it violates the *behavioral contract* "accepted everywhere." The barista (the caller) has to special-case it. The gift card is **not** a true subtype of "payment instrument," even though the type system might say otherwise.

LSP forces you to ask: *"is my subclass really a substitute, or just type-compatible?"* They are not the same thing.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — Square / Rectangle (the canonical LSP trap)

```ts
class Rectangle {
  constructor(public width: number, public height: number) {}
  setWidth(w: number)  { this.width = w; }
  setHeight(h: number) { this.height = h; }
  area() { return this.width * this.height; }
}

// Every Square is a Rectangle in math — so this seems harmless
class Square extends Rectangle {
  override setWidth(w: number)  { this.width = w; this.height = w; }   // 👀 also sets height
  override setHeight(h: number) { this.width = h; this.height = h; }   // 👀 also sets width
}

// Caller, written against Rectangle:
function grow(r: Rectangle) {
  r.setWidth(5);
  r.setHeight(10);
  console.log(`area should be 50, got ${r.area()}`);
}

grow(new Rectangle(0, 0));   // logs 50
grow(new Square(0, 0));      // logs 100  💥
```

**Why it fails:** the caller `grow` was written assuming the parent's contract: *"setWidth and setHeight are independent."* The `Square` violates that invariant — calling `setHeight` also changes `width`. The caller's assumption silently breaks. **A `Square` is not behaviorally a `Rectangle`** in this API, even though it is in geometry. Mathematical hierarchies do not always map to behavioral ones.

### Bad pattern B — Bird / Penguin (the "refused bequest" trap)

```ts
class Bird {
  fly(distance: number) {
    console.log(`flying ${distance}m`);
  }
}

class Sparrow extends Bird {}    // fine
class Eagle extends Bird {}      // fine

class Penguin extends Bird {
  override fly(_distance: number) {
    throw new Error("Penguins can't fly");
  }
}

// Caller written against Bird:
function migrate(birds: Bird[]) {
  for (const b of birds) b.fly(1000);  // crashes when one is a Penguin
}
```

The biological hierarchy says "penguin is a bird." The behavioral contract of `Bird` says "any bird can fly 1000m." `Penguin` cannot honor that. Subclass = lying = LSP violation.

The "fix" of throwing an error is the canonical **refused bequest** smell — a subclass refusing functionality it inherited.

### Bad pattern C — strengthening a precondition

```ts
class FileWriter {
  // accepts ANY non-empty filename
  write(filename: string, content: string) {
    if (!filename) throw new Error("filename required");
    /* write */
  }
}

class TempFileWriter extends FileWriter {
  // child secretly demands the filename START with "/tmp/"
  override write(filename: string, content: string) {
    if (!filename.startsWith("/tmp/")) {
      throw new Error("only /tmp/ paths allowed");   // 👀 stricter than parent
    }
    /* write */
  }
}

// caller, written for FileWriter:
function writeReport(w: FileWriter) {
  w.write("/var/reports/today.txt", "...");   // crashes if w is TempFileWriter
}
```

The child *narrowed* what the parent accepted. Anywhere `FileWriter` worked, `TempFileWriter` doesn't — silently. LSP violation.

### Bad pattern D — weakening a post-condition

```ts
class Repository {
  findUser(id: string): User { /* always returns a real User */
    return loadFromDb(id);
  }
}

class CachedRepository extends Repository {
  override findUser(id: string): User {
    const cached = cache.get(id);
    return cached ?? null!;   // 👀 sometimes returns null in disguise
  }
}
```

Parent promised "always a `User`." Child sometimes hands back `null` cast as `User`. Callers later do `user.name` and crash. LSP violation.

---

## 4. Good Code (the right way)

LSP problems are rarely fixed by tweaking the subclass. They're fixed by **rethinking the hierarchy**: was inheritance the right tool here at all? Usually no.

### Fix for Square / Rectangle

The two shapes don't actually share a behavioral contract. Don't put them in an inheritance relationship. Make `Shape` the abstraction.

```ts
abstract class Shape {
  abstract area(): number;
}

class Rectangle extends Shape {
  constructor(private readonly width: number, private readonly height: number) { super(); }
  area() { return this.width * this.height; }
}

class Square extends Shape {
  constructor(private readonly side: number) { super(); }
  area() { return this.side ** 2; }
}
```

Now both are siblings under `Shape`. Each is **immutable** (no `setWidth`/`setHeight` to violate). Anywhere a `Shape` is expected, both behave correctly. **Composition of geometry, not inheritance.**

If you genuinely need mutability — say a graphics editor — define a separate `MutableRectangle` that doesn't pretend to be substitutable for anything except itself.

### Fix for Bird / Penguin

The contract "a Bird can fly" is too narrow. Not every bird flies. Split the abstraction along the *real* behavioral axis.

```ts
interface Bird {
  eat(): void;
  layEgg(): void;
}

interface FlyingBird extends Bird {
  fly(distance: number): void;
}

interface SwimmingBird extends Bird {
  swim(distance: number): void;
}

class Sparrow  implements FlyingBird { eat() {} layEgg() {} fly(d: number) {} }
class Eagle    implements FlyingBird { eat() {} layEgg() {} fly(d: number) {} }
class Penguin  implements SwimmingBird { eat() {} layEgg() {} swim(d: number) {} }

function migrate(birds: FlyingBird[]) {        // type-narrowed to flyers only
  for (const b of birds) b.fly(1000);
}
```

The compiler now refuses to put a `Penguin` in a list of `FlyingBird`. **The hierarchy reflects behavior, not biology.** This also previews the **Interface Segregation Principle** (next lesson) — small, focused interfaces.

### Fix for the precondition-strengthening case

If a subclass really needs a stricter input, **don't subclass**. Make it a sibling. Or — more cleanly — surface the stricter validation in a *different* method:

```ts
class FileWriter {
  write(filename: string, content: string) { /* ... */ }
}

class TempFileWriter {
  // not a subclass — a different writer with its own stricter rules
  writeTemp(filename: string, content: string) {
    if (!filename.startsWith("/tmp/")) throw new Error("temp paths only");
    /* ... */
  }
}
```

Calling code now picks the right one for the job. No surprise crashes.

### Fix for the post-condition-weakening case

The child has to honor the parent's contract or stop being a child:

```ts
class Repository {
  findUser(id: string): User | undefined { /* parent already admits the optional */ }
}

class CachedRepository extends Repository {
  override findUser(id: string): User | undefined {
    return cache.get(id) ?? super.findUser(id);
  }
}
```

If `null` is a real possibility, lift it into the parent's contract. Then the child can return `undefined` honestly. The child is no longer lying.

### The general LSP playbook

When you spot a smell:
1. **Ask: is the *is-a* relationship behavioral or just nominal?** If nominal — split the hierarchy.
2. **Ask: is the parent's contract too narrow or too wide?** Adjust the parent.
3. **Ask: should this be inheritance at all?** Often the answer is composition (Lesson 04) or sibling interfaces (Lesson 02).

---

## 5. Real-world Use Cases

- **Java's `Vector` vs `List`.** A historical case: `Stack extends Vector` was an LSP violation (a Stack is not a Vector — popping in the middle makes no sense). Modern Java uses composition.
- **DOM API.** `HTMLImageElement` is substitutable for `HTMLElement` — every operation that works on an element works on an image. Clean LSP.
- **`fetch` Response in browsers / Node.** Both `Response` (browser) and `Response` (Node fetch polyfill) honor the same behavioral contract; you can write code against the abstract `Response` without caring which runtime supplies it.
- **`Stream` hierarchies in Node.** `Readable`, `Writable`, `Transform` — each preserves its parent's invariants. Bugs are rare *because* the LSP is honored.
- **React.** `React.Component` and `React.PureComponent` — both substitutable. Subtle: `PureComponent` *narrows* behavior (it skips re-render under shallow equality) but doesn't break callers' assumption that `render` will return the right tree, so LSP holds.
- **NestJS guards.** `CanActivate` interface — every guard implements the same contract. The router doesn't care which guard it has; LSP guarantees safety.
- **SQL adapters / ORMs.** `Prisma` and `TypeORM` both honor a "repository pattern" contract; you can write services against an abstract repo.

When LSP holds in a hierarchy, you can substitute freely. When it breaks, callers start adding `instanceof` checks — the canonical sign that the hierarchy lied to them.

---

## 6. Interview Questions (with answers)

### Q1. *"State the Liskov Substitution Principle in plain English."*

**Answer.** *A subclass must be usable anywhere the parent is expected without surprising the caller.* That means honoring the parent's behavioral contract — accepting at least as much input, returning at least as much guarantee, preserving every invariant. If passing a subclass somewhere breaks the program, the subclass violates LSP — even if the types match.

### Q2. *"Walk me through the Square/Rectangle problem."*

**Answer.** Mathematically, every square is a rectangle. Behaviorally, in a typical `Rectangle` API where `setWidth` and `setHeight` are independent, a `Square` cannot keep both methods independent (changing one must propagate to the other to maintain "all sides equal"). A caller written against `Rectangle` assumes independence — `r.setWidth(5); r.setHeight(10);` should yield area 50. With a `Square`, area is 100 — the caller is silently wrong.

The lesson: **mathematical taxonomy doesn't equal behavioral taxonomy**. The fix is to make `Rectangle` and `Square` siblings under a common `Shape` abstraction, ideally immutable, and let each compute area its own way.

### Q3. *"What are 'pre-conditions cannot be strengthened' and 'post-conditions cannot be weakened'? Give examples."*

**Answer.**

- **Pre-conditions cannot be strengthened.** The child cannot demand more than the parent did. *Example:* parent `write(s: string)` accepts any string; child only accepts non-empty strings. Caller passes empty → parent works, child throws → LSP broken.
- **Post-conditions cannot be weakened.** The child cannot promise less than the parent did. *Example:* parent `findUser` returns a `User`; child sometimes returns `null` cast as `User`. Caller dereferences → crash.

The intuitive shorthand: **be at least as forgiving on input; be at least as strict on output.**

### Q4. *"What's a 'refused bequest' code smell, and how does it relate to LSP?"*

**Answer.** A subclass *inherits* a method but doesn't actually want it — typically signaled by overriding the method to throw `"not implemented"` or to silently no-op. Penguin's `fly()` is the canonical example. It's almost always an LSP violation: the parent's contract said "this method works"; the child silently doesn't honor it. The fix is to *split the parent's interface* (which connects directly to ISP — next lesson) so the child only inherits behavior it actually supports.

### Q5. *"How does LSP relate to OCP?"*

**Answer.** OCP says callers depend on an abstraction; new behavior arrives as new subclasses. That guarantee — *callers don't change when subclasses arrive* — only holds **if every subclass behaves like the parent**. If subclasses break the parent's contract, callers start sprinkling `instanceof` checks to special-case the bad ones, which is exactly the OCP violation we tried to escape.

In one sentence: **LSP is the *correctness guarantee* that makes OCP's *flexibility* safe.** They're best understood as a pair.

### Q6. *"Refactor this Bird hierarchy to honor LSP."*
```ts
class Bird { fly() { /* ... */ } }
class Penguin extends Bird { override fly() { throw new Error(); } }
```

**Answer.** Split the contract along the real behavioral axis — flying is not a universal Bird capability:

```ts
interface Bird { eat(): void; layEgg(): void; }
interface FlyingBird extends Bird { fly(distance: number): void; }
interface SwimmingBird extends Bird { swim(distance: number): void; }

class Sparrow implements FlyingBird { /* ... */ }
class Penguin implements SwimmingBird { /* ... */ }
```

Now any function that requires `FlyingBird` will refuse a `Penguin` at *compile* time. The runtime crash becomes a type error; the LSP violation is gone because the lying contract is gone.

### Q7. *"Are there cases where 'is-a' is true but inheritance is still wrong?"*

**Answer.** Often, yes. Examples:

- *Square is-a Rectangle* mathematically, but their *behavioral* contracts diverge.
- *Penguin is-a Bird* biologically, but the `Bird.fly()` contract excludes them.
- *Stack is-a Vector* by capabilities (it has `add`, `remove`, etc.), but the *invariant* "elements are accessed only at the top" can't be enforced if the parent's API exposes random access.

The trap is treating "shares a noun" as "shares a contract." Real subtyping is **about behavior, not classification.** When in doubt, prefer composition or sibling interfaces.

### Q8 (advanced — bonus). *"What's covariance and contravariance, and how do they relate to LSP?"*

**Answer.** A subclass that overrides a method must keep the **input types contravariant** (accept at least as much) and the **return types covariant** (return at most as much). TS already enforces this (mostly) for classes:

```ts
class Animal {}
class Dog extends Animal {}

class Shelter {
  adopt(): Animal { return new Animal(); }
}
class DogShelter extends Shelter {
  override adopt(): Dog { return new Dog(); }   // ✅ covariant return — narrower is OK
}
```

The variance rules **are LSP**, expressed in type theory. Don't bring this up unless asked — but it's nice to know it's the same idea.

---

## Recap — what to remember

1. **LSP — a subclass must be substitutable for its parent without surprising the caller.**
2. The contract isn't just types — it's pre-conditions, post-conditions, and invariants.
3. **Mathematical / biological / nominal "is-a" ≠ behavioral is-a.** Square/Rectangle and Bird/Penguin make this explicit.
4. The fix is rarely tweaking the subclass — it's **redesigning the hierarchy**: split contracts along behavioral axes, make siblings instead of parent-child, prefer composition.
5. **Refused bequest** (throw "not implemented" in a subclass) is the smell that screams LSP violation.
6. **LSP is the correctness guarantee that makes OCP safe.** They're best understood together.
7. Tests should not differ wildly between parent and child — if they do, the child is probably lying about being a substitute.

---

## What's next
Lesson 13 — **SOLID: I — Interface Segregation Principle**. Why fat interfaces (`IService` with 25 methods) hurt — and how splitting them into role-based interfaces makes everything testable, swappable, and future-proof. We've already seen the prelude in this lesson's Bird refactor.
