# Lesson 01 — Classes, Objects & Access Modifiers

> **Phase 1 — TypeScript for LLD**
> Foundation lesson. Every other LLD topic builds on this.

---

## 1. Concept / Theory

### What is a class?
A **class** is a blueprint. It describes:
- what data an object holds (**fields / properties**)
- what an object can do (**methods**)
- how it is created (**constructor**)
- who is allowed to read or change its data (**access modifiers**)

An **object** is an instance of a class — the actual thing in memory created from the blueprint.

```ts
class Car {
  brand: string;
  constructor(brand: string) {
    this.brand = brand;
  }
}

const c1 = new Car("Tesla"); // c1 is an OBJECT, Car is the CLASS
```

### Why do we need classes in LLD?
LLD is fundamentally about **modeling real-world entities** as code.
- A `User` in an app
- A `Booking` in Uber
- A `ParkingSpot` in a parking lot system

Classes are how we package the **state + behavior** of these entities together. This packaging is called **encapsulation** — and encapsulation is what access modifiers protect.

### Access modifiers — the four you must know

| Modifier      | Visible from     | Used for                              |
| ------------- | ---------------- | ------------------------------------- |
| `public`      | anywhere (default) | external API of the class            |
| `private`     | same class only  | internal state nobody else should touch |
| `protected`   | class + subclasses | shared internals for inheritance     |
| `readonly`    | (combined with above) prevents reassignment after construction | IDs, configs, dates of creation |

> TS also supports the JS-native `#privateField` syntax, which gives **runtime** privacy (truly hidden, even at runtime). `private` from TS is compile-time only — it disappears at runtime. For interviews, **`private`** is enough; mention `#` if asked about runtime guarantees.

### Parameter properties (a TS shortcut you'll use 90% of the time)

```ts
class User {
  constructor(
    public readonly id: string,
    public name: string,
    private email: string,
  ) {}
}
```
This single declaration creates the fields *and* assigns them. No `this.id = id` boilerplate.

---

## 2. Real-life Analogy

Think of a **bank account**.

- The **balance** is private — you don't let anyone reach into the vault and change the number directly.
- The **account number** is readonly — once assigned, it never changes.
- **Deposit** and **withdraw** are public methods — the only allowed ways to modify the balance, with rules baked in (no negative withdraws, no overdraft, log every transaction).

If the balance were public, anyone could write `account.balance = 999999999` and bypass every rule. Access modifiers are how we **enforce invariants** — the rules that must always hold.

---

## 3. Bad Code (what NOT to do)

A junior dev models a bank account like this:

```ts
// ❌ BAD: everything public, no encapsulation
class BankAccount {
  accountNumber: string;
  balance: number;
  transactions: string[];

  constructor(accountNumber: string, openingBalance: number) {
    this.accountNumber = accountNumber;
    this.balance = openingBalance;
    this.transactions = [];
  }
}

const acc = new BankAccount("ACC-001", 1000);
acc.balance = -50_000;            // silently invalid state
acc.accountNumber = "ACC-002";    // identity changed mid-flight
acc.transactions.push("hacked");  // anyone can rewrite history
```

**Why it fails:**
1. **No invariants.** Balance can go negative without any validation.
2. **Identity is mutable.** Account number was never supposed to change.
3. **Internal state is exposed.** `transactions` is implementation detail; consumers shouldn't poke at the array.
4. **No single source of truth for "deposit / withdraw" logic** — every caller will reinvent it, inconsistently.
5. **Untestable invariants.** You can't unit-test "you cannot overdraw" because there is no method that enforces it.

This is a "**god object**" in miniature — data with no protection. It's the #1 reason codebases rot.

---

## 4. Good Code (the right way)

```ts
// ✅ GOOD: encapsulated, invariants enforced, identity readonly
class BankAccount {
  private balance: number;
  private readonly transactions: Transaction[] = [];

  constructor(
    public readonly accountNumber: string,
    public readonly ownerName: string,
    openingBalance: number,
  ) {
    if (openingBalance < 0) {
      throw new Error("Opening balance cannot be negative");
    }
    this.balance = openingBalance;
  }

  deposit(amount: number): void {
    this.assertPositive(amount);
    this.balance += amount;
    this.transactions.push({ type: "DEPOSIT", amount, at: new Date() });
  }

  withdraw(amount: number): void {
    this.assertPositive(amount);
    if (amount > this.balance) {
      throw new Error("Insufficient funds");
    }
    this.balance -= amount;
    this.transactions.push({ type: "WITHDRAW", amount, at: new Date() });
  }

  getBalance(): number {
    return this.balance; // controlled read
  }

  getStatement(): readonly Transaction[] {
    return this.transactions; // returns a readonly view
  }

  private assertPositive(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
  }
}

type Transaction = {
  type: "DEPOSIT" | "WITHDRAW";
  amount: number;
  at: Date;
};
```

What changed and **why it matters**:

| Choice                                  | Why                                                          |
| --------------------------------------- | ------------------------------------------------------------ |
| `balance` is `private`                  | Can only change via `deposit` / `withdraw`, where rules live |
| `accountNumber` is `public readonly`    | Identity is exposed for reads but immutable                  |
| `transactions` is `private readonly`    | Reference can't be reassigned; outside world can't replace history |
| `getStatement()` returns `readonly Transaction[]` | Even a returned reference can't be mutated by callers |
| `assertPositive` is `private`           | Internal helper, not part of the public API                  |
| Invariants live in **one place**        | Validation isn't scattered across the codebase               |

---

## 5. Real-world Use Cases

- **Stripe / Razorpay SDKs**: `Charge` and `Refund` objects expose `id`, `amount`, `status` as `readonly` because they reflect server state — mutating them on the client is a bug.
- **React-style components**: hooks like `useState` give you `[value, setValue]` precisely because `value` is treated as effectively `readonly` from the consumer's perspective; you must call the setter.
- **TypeORM / Prisma entities**: primary keys are typically `readonly`. The repository owns mutation.
- **Domain-Driven Design "aggregates"**: `Order`, `Cart`, `Booking` — they enforce invariants like "an order in `SHIPPED` state can't be edited" using private state + public methods.
- **Game engines**: a `Player` exposes `move()` and `attack()` but its `hp` is private, so debuffs and shields are applied through the only allowed paths.

---

## 6. Interview Questions (with answers)

### Q1. *"What's the difference between `private` and `#` private fields in TypeScript?"*

**Answer.** `private` is a TypeScript-only modifier — it's enforced by the compiler but at **runtime** the field is just a normal JS property. So `(account as any).balance` will still let you read it, and so will `Object.keys(account)`. The `#field` syntax is **JavaScript-native** privacy — the field is genuinely inaccessible from outside the class at runtime, even via reflection. Use `private` for normal app code (cheap, sufficient). Use `#` when you must guarantee no external access — e.g., security-sensitive libraries.

### Q2. *"Why is `readonly` not the same as `const`?"*

**Answer.** `const` is for variable bindings — it prevents **reassignment** of the variable itself. `readonly` is for object properties — it prevents reassignment of the property after construction, but the property's contents can still be mutated if the value is a reference type. Example:

```ts
class C {
  readonly tags: string[] = [];
}
const c = new C();
c.tags = [];      // ❌ error
c.tags.push("x"); // ✅ allowed — readonly doesn't deep-freeze
```

To get deep immutability, use `ReadonlyArray<T>` / `readonly T[]` types or `Object.freeze`.

### Q3. *"When would you choose `protected` over `private`?"*

**Answer.** `protected` when subclasses legitimately need access to the field/method as part of the inheritance contract. Example: a base `HttpClient` exposes a `protected makeRequest()` so subclasses like `RestClient` and `GraphQLClient` can build on it, but external code can't call it. Default to `private`; promote to `protected` only when a subclass-only API emerges. Over-using `protected` defeats encapsulation just like making everything public.

### Q4. *"What's wrong with this code?"*
```ts
class Cart {
  items: Item[] = [];
  total = 0;

  addItem(item: Item) {
    this.items.push(item);
    this.total += item.price;
  }
}
```

**Answer.** Three issues:
1. `items` and `total` are public — callers can mutate `cart.total = 0` and break the invariant `total == sum(items.price)`.
2. `total` is **derived state** stored as a field — it can drift out of sync with `items`. Either compute it on demand (`get total()`) or make it private and only update it inside `addItem` / `removeItem`.
3. Returning the live `items` array gives outsiders a handle to mutate it. Either expose `readonly Item[]` or return a copy.

Refactored:
```ts
class Cart {
  private readonly items: Item[] = [];

  addItem(item: Item): void { this.items.push(item); }
  removeItem(itemId: string): void { /* ... */ }
  get total(): number { return this.items.reduce((s, i) => s + i.price, 0); }
  getItems(): readonly Item[] { return this.items; }
}
```

### Q5. *"Parameter properties — what are they and what are the trade-offs?"*

**Answer.** Parameter properties let you declare and initialize a class field directly in the constructor signature:

```ts
class User {
  constructor(public id: string, private email: string) {}
}
```

This is equivalent to declaring `public id`, `private email` and assigning them in the constructor body. Trade-offs:
- ✅ Less boilerplate. ✅ Encourages immutability when combined with `readonly`.
- ❌ Mixes "field declaration" with "constructor logic" — for classes with many fields, some teams prefer the explicit form for readability.
- ❌ Doesn't work in plain JS classes — code becomes TS-only.

Most LLD interview code uses parameter properties because they keep classes terse.

---

## Recap — what to remember

1. A **class** packages state + behavior. An **object** is an instance.
2. Use **access modifiers** to enforce invariants — make state `private`, expose behavior as methods.
3. `readonly` is for properties that should never change after construction (IDs, config).
4. Prefer **parameter properties** for short constructors.
5. Returning internal collections? Return `readonly T[]` or a copy — never the live reference.
6. The bigger lesson: **a public field is a public commitment.** Making it private later is a breaking change. Start private.

---

## What's next
Lesson 02 — **Interfaces & Abstract Classes**: how to declare contracts, when to use which, and the structural-typing quirk that surprises everyone coming from Java/C#.
