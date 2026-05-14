# 34 — Refactoring & Code Smells

> Phase 6 — Refactoring
> Source-of-truth: Martin Fowler's "Refactoring" (with Kent Beck)
> Audience: an engineer reviewing or maintaining a real codebase

---

## 1. What is refactoring?

**Refactoring** is *changing the internal structure of code without changing its external behavior.* You don't add features, fix bugs, or change the API contract. You change the code's shape so it's easier to read, change, and extend.

Two non-negotiable properties:

1. **Behavior-preserving.** The same inputs produce the same outputs.
2. **Done in small, safe steps.** Each step is small enough that you trust it, and tests after each step prove behavior is preserved.

If you change behavior, that's a feature change or a bug fix — not a refactor. If you make a giant rewrite that you "verify by hand," that's not a refactor either; that's a rewrite. The discipline matters because *most large refactors fail* — they go off the rails because someone tries to do it in one step.

### Why this matters for interviews

LLD interviewers love asking *"what's wrong with this code?"* and *"how would you improve it?"* These are refactoring questions in disguise. They test:

* Can you **identify smells** by name? (You've seen them; you have vocabulary.)
* Can you propose **specific moves**, not vague "I'd clean it up"?
* Do you know which refactorings lead toward which patterns?

This lesson is the bridge between "I know patterns" (Lessons 16–32) and "I can apply them to make real code better."

---

## 2. The Code Smell Catalog

A **code smell** is a hint — not a definitive diagnosis — that something might be wrong. The seasoned engineer's job is to recognize the smell, then decide whether the cost of fixing it is worth the benefit.

Below are the smells you should recognize on sight. For each: what it looks like, why it's bad, and the typical refactoring move.

### 2.1 Long Method / Long Function

**Smell:** A function with 50, 100, 300 lines, doing many things.

**Why bad:** Hard to read; hard to test; impossible to reuse parts.

**Fix:** **Extract Method** — name a coherent block of code, lift it out, replace with the call. Keep extracting until each function is one thing.

```ts
// Before
function processOrder(o: Order) { /* 80 lines */ }

// After
function processOrder(o: Order) {
  validate(o);
  const total = computeTotal(o);
  charge(o.userId, total);
  persist(o, total);
  notify(o.email);
}
```

---

### 2.2 Large Class / God Class

**Smell:** A class with 30+ methods or 500+ lines, knowing about half the system. Common names: `Manager`, `Helper`, `Util`, `Service`, `Processor`.

**Why bad:** Multiple responsibilities → multiple reasons to change → bugs every release.

**Fix:** **Extract Class** — group cohesive methods + their fields, lift them out into a new class. Repeat until each class has *one* responsibility.

This often leads to: Adapter (for external integration), Strategy (for variable algorithms), Facade (for orchestration).

---

### 2.3 Duplicated Code

**Smell:** The same five lines (with minor variation) appear in three places.

**Why bad:** Changes have to happen N times; one place will be missed.

**Fix:** **Extract Method** if local; **Extract Class** if it spans modules; **Pull Up Method** if siblings duplicate (lift to a parent class). When the duplication is "structurally identical but conceptually different," resist DRY — duplication is sometimes cheaper than the wrong abstraction (Lesson 33).

---

### 2.4 Long Parameter List

**Smell:** `createUser(name, email, age, country, isAdmin, isPremium, referralCode, ...)` with 6+ args.

**Why bad:** Hard to read at call sites; easy to swap arguments by accident; adding a new parameter ripples to every caller.

**Fix:** **Introduce Parameter Object** — bundle related args into a struct.

```ts
// Before
function createUser(name: string, email: string, age: number, country: string, isAdmin: boolean) {}

// After
type CreateUserInput = { name: string; email: string; age: number; country: string; isAdmin: boolean };
function createUser(input: CreateUserInput) {}
```

If the parameter object is being used a lot, it might want to become a real class (with methods and validation).

For complex multi-step construction, this can lead to **Builder** (Lesson 19).

---

### 2.5 Switch Statements / Type Codes

**Smell:** Multiple methods all switch on the same `type` field.

```ts
class Shape {
  type: "circle" | "square" | "triangle";
  area() { switch (this.type) { ... } }
  perimeter() { switch (this.type) { ... } }
  draw() { switch (this.type) { ... } }
}
```

**Why bad:** Adding a new variant edits every method. OCP violation. Pattern matching in 17 places that all need to stay in sync.

**Fix:** **Replace Conditional with Polymorphism** — one subclass per type, each implementing the methods. Often this leads directly to **Strategy** or **State**.

```ts
abstract class Shape { abstract area(): number; abstract perimeter(): number; abstract draw(): void; }
class Circle extends Shape { area() {} perimeter() {} draw() {} }
class Square extends Shape { area() {} perimeter() {} draw() {} }
```

When the variant types control different *workflows or stages*, it's State; when it's one of several *algorithms*, it's Strategy; when it's "build the right thing at construction time," it's Factory.

---

### 2.6 Feature Envy

**Smell:** A method on class `A` that talks to class `B` more than to its own data.

```ts
class Order {
  computeShippingCost(addr: Address) {
    let cost = addr.country === "US" ? 5 : addr.country === "UK" ? 8 : 12;
    if (addr.isPOBox) cost += 2;
    if (addr.zip.startsWith("9")) cost *= 1.1;   // tax adjustment
    return cost;
  }
}
```

**Why bad:** The method has *Address envy* — it spends all its time poking at Address fields. The behavior belongs on Address, not Order.

**Fix:** **Move Method** — move the method to the class whose data it actually uses.

```ts
class Address {
  shippingCost(): number {
    let cost = this.country === "US" ? 5 : this.country === "UK" ? 8 : 12;
    if (this.isPOBox) cost += 2;
    if (this.zip.startsWith("9")) cost *= 1.1;
    return cost;
  }
}
class Order {
  computeShippingCost() { return this.address.shippingCost(); }
}
```

Feature Envy is often a strong signal that **a class is missing**. The data wants its own class with its own behavior.

---

### 2.7 Data Clumps

**Smell:** Three or four variables that *always* appear together, scattered across functions and classes.

```ts
function bookFlight(fromCity: string, fromCountry: string, fromAirport: string,
                    toCity: string,   toCountry: string,   toAirport: string,
                    date: Date) { ... }
```

**Why bad:** They're conceptually one thing but the code keeps treating them as three. Changing what makes a "location" requires editing every signature.

**Fix:** **Introduce Parameter Object** + **Extract Class**.

```ts
class Location {
  constructor(public city: string, public country: string, public airport: string) {}
}
function bookFlight(from: Location, to: Location, date: Date) {}
```

The new class likely deserves behavior (validation, formatting, distance computation) — that's Feature Envy in reverse.

---

### 2.8 Primitive Obsession

**Smell:** Using primitives (`string`, `number`, `boolean`) where a domain type would be clearer or safer. Especially: `string` for IDs, currencies, emails, dates-as-strings, country codes; `number` for money or units.

```ts
// What is a string here? Email? UUID? Username?
function refund(userId: string, amount: number, currency: string) {}
```

**Why bad:** No type safety against mixing things up (`refund(amount, userId, ...)` compiles fine). Validation scattered everywhere. Operations like "convert currency" or "validate email" duplicated.

**Fix:** **Replace Primitive with Object** — branded types, value objects, small classes.

```ts
type UserId   = string & { __brand: "UserId" };
type Email    = string & { __brand: "Email" };

class Money {
  constructor(public amount: number, public currency: "USD" | "INR" | "EUR") {}
  add(other: Money): Money { /* check currency */ return new Money(this.amount + other.amount, this.currency); }
}

function refund(userId: UserId, amount: Money) {}
```

In TS, **branded types** are a lightweight way to get domain-typing without runtime objects. Money/Email/Date often deserve real classes.

---

### 2.9 Shotgun Surgery

**Smell:** A single change requires editing 7 different files in 7 different places.

**Why bad:** The system is *spreading* a single concern across many places. The opposite of cohesion.

**Fix:** **Move Method** / **Move Field** / **Inline Class** to consolidate the concern. The goal: one concern lives in one (or few cohesive) places, so a future change requires editing one (or few) files.

If "adding a new payment provider" required editing the `Order`, the `User`, the `EmailService`, the `Reports`, and the `Analytics`... that's shotgun surgery, and you need a `PaymentProvider` interface that those classes consume — almost certainly Strategy + Adapter (Lessons 21, 26).

---

### 2.10 Divergent Change

**Smell:** The opposite of shotgun surgery: a single class changes for many *unrelated* reasons. "Every release we touch this class — for tax rules, for shipping, for emails, for analytics."

**Why bad:** The class has multiple responsibilities (SRP violation) — and any change risks breaking unrelated functionality.

**Fix:** **Extract Class**. Pull each "reason to change" into its own class.

Shotgun surgery and divergent change are opposite smells but they often coexist — a god class causes divergent change; the desperate workarounds cause shotgun surgery.

---

### 2.11 Inappropriate Intimacy

**Smell:** Two classes that know too much about each other's internals — accessing private fields via getters, calling each other's deeply-internal methods.

**Why bad:** They're tangled; you can't change either without breaking the other.

**Fix:** **Move Method**, **Hide Delegate**, sometimes **Extract Class** to introduce a third class that intermediates. Maybe **Mediator** if N-to-N tangling.

---

### 2.12 Speculative Generality

**Smell:** Abstractions, base classes, and parameters added "for the future" that no one ever needs. Empty hooks. Single-implementation interfaces. `Map<string, unknown>` config that only ever has three keys.

**Why bad:** Adds ceremony for no payoff. Future readers wonder why the abstraction exists. YAGNI violation.

**Fix:** **Inline Class**, **Inline Method**, **Collapse Hierarchy**. Delete the speculative parts. You can always add them back when the second use case shows up.

---

### 2.13 Comments (sometimes a smell)

**Smell:** A long comment explaining *what* a function does.

**Why suspicious:** If the code itself was clear, the comment wouldn't be needed. The comment is often a "deodorant" hiding bad code.

**Fix:** Rename the function, extract sub-methods, simplify until the comment is unnecessary. Keep comments that explain *why* (constraints, rationale, history) — those earn their place.

---

### 2.14 Dead Code

**Smell:** Code never reached, never called. Variables never read. Branches never taken.

**Why bad:** Confuses readers — they wonder if it's important.

**Fix:** Delete it. Git remembers. Unused imports, unused functions, commented-out code — all gone.

---

### 2.15 Refused Bequest

**Smell:** A subclass inherits methods/fields it doesn't actually use, or overrides them to do nothing / throw.

```ts
class Bird { fly() {} eat() {} }
class Penguin extends Bird {
  fly() { throw new Error("penguins can't fly"); }   // refused bequest
}
```

**Why bad:** LSP violation. The subclass isn't substitutable for the base.

**Fix:** Restructure the hierarchy. Replace inheritance with composition. Often the fix is to introduce a smaller interface and have the parent and the misfit each implement what's appropriate.

---

### 2.16 Temporary Field

**Smell:** A field on a class that's only set during certain operations, null/undefined the rest of the time.

**Why bad:** The class's contract is unclear — "is this field meaningful right now?"

**Fix:** **Extract Class** for the operation that uses the field (the field becomes part of the new class's lifecycle). This is often the seed of the **Method Object** refactoring.

---

## 3. Common refactoring moves (the toolkit)

Smells suggest *what* needs fixing; refactorings are *how*. Here are the moves you should know by name; they're discussed in interviews and in code review.

| Refactoring | What it does | Common trigger |
| --- | --- | --- |
| **Extract Method** | Pull a block of code into a new function | Long Method, Duplicated Code |
| **Inline Method** | Replace a call with the method's body | Speculative Generality, trivial wrapper |
| **Extract Class** | Pull cohesive methods + fields into a new class | Large Class, Data Clumps |
| **Inline Class** | Move a class's contents into another | Speculative Generality |
| **Move Method / Field** | Move to the class that uses it most | Feature Envy, Inappropriate Intimacy |
| **Rename** | Better name | Bad name (always) |
| **Introduce Parameter Object** | Bundle related args | Long Parameter List, Data Clumps |
| **Replace Magic Number with Constant** | Name the value | Magic Numbers/Strings |
| **Replace Conditional with Polymorphism** | Subclasses replace a switch | Switch on Type Code |
| **Replace Inheritance with Composition** | Hold the type instead of extending | Refused Bequest, deep hierarchies |
| **Pull Up / Push Down Method** | Move methods up/down the hierarchy | Duplication across siblings, behavior in wrong place |
| **Extract Interface** | Define the contract of what callers actually use | Inappropriate Intimacy, testability |
| **Encapsulate Field** | Wrap a public field with getter/setter | Inappropriate Intimacy |
| **Replace Constructor with Factory Method** | Hide concrete-class choice behind a function | Type-code construction |
| **Introduce Null Object** | A "do-nothing" subclass instead of `null` checks | Repeated null checks |
| **Replace Conditional with Guard Clauses** | Early returns flatten nested ifs | Deep nesting |

You don't need to memorize all 60+ in Fowler's catalog. These are the bread-and-butter moves you'll do (and discuss) constantly.

---

## 4. Refactoring TO patterns — the bridge

The deep insight is that *smells suggest specific patterns as destinations.* Joshua Kerievsky's "Refactoring to Patterns" maps this explicitly. Some of the most useful mappings:

| Smell | Refactor towards |
| --- | --- |
| Switch on type code | **Strategy** or **State** (Replace Conditional with Polymorphism) |
| Telescoping constructor / many optional params | **Builder** |
| Subclass explosion (every combo a class) | **Decorator** + composition |
| Tightly coupled classes that need to communicate | **Mediator** or **Observer** |
| One operation, many implementations selected by key | **Factory** + **Strategy** |
| Multiple steps with fixed order, varying step bodies | **Template Method** (or function composition) |
| Tree of objects with uniform operations | **Composite** |
| Many small handlers, only one should run | **Chain of Responsibility** (pure form) |
| Many small handlers, all run in sequence | **Chain of Responsibility** (pipeline form) |
| Cross-cutting concerns (log, retry, cache) | **Decorator** |
| Need to lazy-load / gate access | **Proxy** |
| Need to copy expensive objects with variation | **Prototype** |
| Need to make foreign API fit our shape | **Adapter** |
| Complex subsystem clients keep tangling with | **Facade** |

When an interviewer hands you bad code, your mental flow should be:

1. Read it; name the smells you see.
2. For each smell, identify the natural refactoring move(s).
3. Note where those moves lead (often, a pattern from Lessons 16–32).
4. Decide which fixes are *worth* the effort — don't blindly apply patterns.

That mental flow is the senior-engineer skill the interviewer is looking for.

---

## 5. The two-hat rule (Fowler)

When you sit down to work, you're wearing one of two hats:

* **Refactoring hat** — improving code structure, behavior unchanged. No new features. No bug fixes. Tests stay green.
* **Feature hat** — adding new behavior. Code structure stays approximately as you found it (or you do small refactors *first*, then add the feature on a clean structure).

Don't wear both at once. The bug in feature work is mixing in "while I'm here, let me tidy up" — which expands the diff, mixes concerns, and risks breaking things you didn't mean to.

The rhythm is: **refactor first, then add the feature**. The refactor makes the feature easy; then you add it. Two small commits, each clean.

This shows up in interviews as "how do you approach a feature in a messy codebase?" The senior answer: refactor what you need to change *to make the change easy*, then make the easy change.

---

## 6. Interview Questions

### Q1. What's a code smell, and how do you decide whether to fix it?

**Answer:** A code smell is a hint that something *might* be wrong with the structure of code — long methods, god classes, duplicated code, primitive obsession, etc. They're not definitive bugs; they're signals worth investigating.

Whether to fix depends on:

1. **Is this code changing soon?** If you're about to add a feature here, fixing the smell first pays off immediately.
2. **Is the smell causing real pain?** If duplication has caused inconsistent bug fixes in the past, it's costing you.
3. **What's the cost of the fix?** Some refactorings are mechanical and safe; others require deep understanding.
4. **Is there test coverage?** Refactoring without tests is gambling; refactoring with tests is safe.

The rule of thumb: **fix smells in code you're touching anyway.** Don't make a separate "cleanup project" for distant code that's working fine. Don't ignore smells in code you're actively changing — that's where they cost the most.

---

### Q2. How would you refactor a 500-line method?

**Answer:** Carefully, in small steps, with tests anchoring each one.

1. **Run the tests.** If there aren't any, write characterization tests — capture current behavior in tests so you know if you break it.
2. **Read the whole thing**, identify natural sections (validation, computation, persistence, notification, etc.).
3. **Extract Method**, one section at a time. Name each by *intent*. Run tests after each.
4. After 3–5 extractions, the original method shrinks to a high-level outline that reads top-to-bottom like a story.
5. **Look at the helpers** — some may belong on different classes (Move Method) if they smell like Feature Envy.
6. **Stop when the method is readable and each helper does one thing**, even if you haven't done a "perfect" job. Diminishing returns kick in fast.

Things the interviewer wants to hear:

* Tests first.
* Small steps, not a rewrite.
* Names by intent, not implementation.
* Stop at "good enough"; don't over-engineer.
* Watch for follow-on smells (Feature Envy on the new helpers).

---

### Q3. Walk me through identifying smells in this code.

**Answer pattern:** When given code, name smells *by name* and propose specific moves. Example response if shown a long switch on type:

> "A few smells. **Switch statement on a type code** — every method probably switches the same way; that suggests **Replace Conditional with Polymorphism**, leading to **Strategy** or **State** depending on whether the variants are independent algorithms or workflow stages.
>
> The `total = a + b - c + d - tax` line uses primitives where a `Money` value object would prevent currency-mixing bugs — **Primitive Obsession** smell, fix with **Replace Primitive with Object**.
>
> The method is 80 lines doing validation + computation + persistence + notification — **Long Method**, fix with **Extract Method** for each section. Once extracted, the validation block looks like it belongs on the input DTO, not on the service — **Feature Envy**, **Move Method**.
>
> If I were doing this for real, I'd add tests first to characterize behavior, then refactor in small steps."

That answer hits: vocabulary, specific moves, awareness of follow-ons, discipline (tests first, small steps).

---

### Q4. When does refactoring TO a pattern make things worse?

**Answer:** When the pattern adds ceremony without solving a real problem in the system.

Concretely:

1. **YAGNI violation.** Adding Strategy when there's only ever one strategy variant. Adding Factory for one concrete class. Adding Observer for one listener. The pattern's machinery overhead exceeds its value.
2. **Wrong abstraction.** Extracting a Strategy interface that two classes "share" because they look similar — but they conceptually represent different things. The interface ends up forcing both implementations into a shape that doesn't fit.
3. **Over-decomposition.** Splitting a 60-line method into 12 three-liners that each call the next. Now you can't read it; you have to chase calls. Patterns are tools, not goals.
4. **Hierarchy hell.** Inheritance-based patterns (Template Method, Composite-via-inheritance) added when composition is more flexible. Modern preference: composition first, inheritance only when there's a real "is-a."

The rule: **refactor TO a pattern when the system shows the symptoms the pattern solves.** Don't reach for patterns by reflex. The interview answer that wins is: "I'd reach for it the day a second variant shows up. Until then, the simpler form is right."

---

### Q5. Two-hat rule — what is it and why does it matter?

**Answer:** Fowler's idea: at any moment you're wearing one of two hats — **refactoring hat** (improving structure, behavior unchanged) or **feature hat** (adding behavior, structure unchanged). Don't wear both at once.

Why it matters:

1. **Reviewability.** A diff that does *only* refactoring is easy to review — reviewer just verifies behavior is preserved. A diff that mixes refactor + feature is hard — the reviewer can't tell if the structural changes are intentional or buggy.
2. **Reversibility.** If a feature is wrong, you want to revert *just the feature*. If it's mixed with refactors, reverting takes the refactors with it.
3. **Mental load.** Each hat requires different thinking. Refactor hat: "did I preserve behavior?" Feature hat: "is this the right behavior?" Splitting them makes both clearer.
4. **Tests.** Refactoring requires tests to be green throughout. Feature work might add tests for new behavior. Mixed-mode work makes it hard to know which test failures matter.

The rhythm: refactor first to make the change easy, then make the easy change. Two commits. Each clean. **"Make the change easy, then make the easy change"** — Kent Beck's line, and probably the single most senior thing you can say about refactoring.

---

## TL;DR Cheat Sheet

```
Refactoring = changing structure without changing behavior, in small
              tested steps.

Smells you should recognize on sight:
  - Long Method                  → Extract Method
  - Large/God Class              → Extract Class
  - Duplicated Code              → Extract Method/Class, Pull Up
  - Long Parameter List          → Introduce Parameter Object
  - Switch on type               → Replace Conditional with Polymorphism
                                    → Strategy / State / Polymorphism
  - Feature Envy                 → Move Method
  - Data Clumps                  → Extract Class
  - Primitive Obsession          → Replace Primitive with Object (+ branded types)
  - Shotgun Surgery              → Move Method, consolidate the concern
  - Divergent Change             → Extract Class
  - Inappropriate Intimacy       → Hide Delegate, Move Method
  - Speculative Generality       → Inline Class/Method, delete unused
  - Comments explaining what     → Rename, Extract until comment unneeded
  - Dead Code                    → Delete
  - Refused Bequest              → Replace Inheritance with Composition

Refactoring TO patterns:
  - Switch on type        → Strategy / State
  - Many optional params  → Builder
  - Subclass explosion    → Decorator
  - Cross-cutting concerns→ Decorator
  - Foreign API mismatch  → Adapter
  - Complex subsystem     → Facade
  - Tree operations       → Composite
  - Pluggable handlers    → Chain of Responsibility
  - Lazy / gated access   → Proxy
  - Many subscribers      → Observer
  - Need to copy w/ vary  → Prototype

Process:
  1. Tests first (write characterization tests if missing).
  2. Small steps; tests green after each.
  3. One concern per step; don't mix refactor + feature.
  4. Name by intent.
  5. Stop at "good enough" — diminishing returns kick in fast.

Two-hat rule (Fowler):
  - Refactoring hat:  structure changes, behavior preserved.
  - Feature hat:      behavior changes, structure preserved.
  - Don't wear both. Rhythm: refactor to make the change easy, then make
    the easy change.

Interview gold: name smells BY NAME, propose SPECIFIC moves, mention
                tests-first and small-steps, articulate when patterns
                are overkill (YAGNI). Quote Beck: "Make the change
                easy, then make the easy change."
```
