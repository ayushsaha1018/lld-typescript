# 15 — UML Class Diagrams & Relationships

> Phase 3 — UML & Design Basics
> Topics: Class diagrams, Association, Aggregation, Composition, Dependency, Inheritance, Realization

---

## 1. Concept / Theory

UML (Unified Modeling Language) is the standard "blueprint language" for OOP design. In an LLD interview, you don't need to be a UML expert — you need to:

1. Sketch a **class diagram** that shows entities + relationships.
2. Pick the **right kind of arrow** (the relationship type), because the arrow tells the interviewer how strongly two classes are coupled and who owns whose lifetime.

You typically draw this on a whiteboard / Excalidraw in the first 5–10 minutes of the interview, right after gathering requirements. It's the bridge between "I understand the problem" and "here's my code."

### A class box

```
┌──────────────────────────┐
│        Order             │  <- class name
├──────────────────────────┤
│ - id: string             │  <- attributes
│ - items: OrderItem[]     │
│ + total: number          │
├──────────────────────────┤
│ + addItem(i): void       │  <- methods
│ + checkout(): Receipt    │
└──────────────────────────┘
```

Visibility markers: `+` public, `-` private, `#` protected, `~` package.
Underline static members. Italicize abstract classes and methods.

### The 6 relationships you must know

| Relationship       | Arrow                      | Meaning                                        | Lifetime tie? |
| ------------------ | -------------------------- | ---------------------------------------------- | ------------- |
| **Association**    | `──→` (plain arrow)        | "uses" / "knows about" — generic structural link | No            |
| **Aggregation**    | `──◇` (open diamond)       | "has-a", but parts can live without the whole  | No            |
| **Composition**    | `──◆` (filled diamond)     | "has-a" + parts die with the whole             | **Yes**       |
| **Dependency**     | `--→` (dashed arrow)       | "uses temporarily" — usually a method param/return | No        |
| **Inheritance**    | `──▷` (hollow triangle)    | "is-a", `extends` a class                      | No            |
| **Realization**    | `--▷` (dashed hollow tri)  | "implements" an interface                      | No            |

Rule of thumb for the confusing trio (the diamonds + dashed arrow):

* **Composition** — the part *cannot* exist meaningfully without the whole. House → Room. Destroy the house, the rooms die. The whole **creates and owns** the parts.
* **Aggregation** — the whole holds a reference to the part, but the part lives independently. University → Student. Close the university, students still exist.
* **Dependency** — short-lived, transient use. The class doesn't store the other as a field; it just touches it inside one method.

Also note **multiplicity** on the line ends: `1`, `0..1`, `*`, `1..*`, `0..*`. E.g. an `Order ──◆ 1..* OrderItem` means "an Order is composed of one or more OrderItems."

---

## 2. Real-life Analogy

Think about a **car**:

* Car **is-a** Vehicle → **Inheritance**
* Car **has** an Engine that was built into it and gets scrapped with it → **Composition** (filled diamond)
* Car **has** a Driver who can leave and drive a different car tomorrow → **Aggregation** (open diamond)
* Car **uses** a FuelStation when it refuels (just for that interaction) → **Dependency** (dashed arrow)
* Car **implements** the `Drivable` interface → **Realization** (dashed triangle)
* Car **is associated with** a RegistrationAuthority record → **Association** (plain line)

If you can describe a system using these six words, you can draw any UML diagram in an interview.

---

## 3. Bad Code Example — Wrong Relationship Choice

This is a classic interview mistake: modeling everything as composition because "the class has a field of that type." Watch what happens when an `Order` is wrongly composed of a `Customer`.

```ts
// ❌ BAD: Order COMPOSES Customer
class Customer {
  constructor(public id: string, public name: string) {}
}

class Order {
  private customer: Customer;
  constructor(customerId: string, customerName: string) {
    // Order CREATES the customer internally → composition semantics
    this.customer = new Customer(customerId, customerName);
  }

  cancel() {
    // and when the order is cancelled, we throw the customer away too?!
    // (this is what composition implies: parts die with the whole)
  }
}

const o = new Order("u1", "Ayush");
// Where does this Customer live? Only inside Order.
// If Ayush places another order, we create a *second* Customer object
// for the same person. There's no shared identity, no single source of truth.
```

Problems:

1. **Identity duplication** — same human, multiple Customer objects.
2. **Wrong lifetime** — Customer should outlive Order, not vice versa.
3. **Untestable** — you can't inject a fake customer; Order builds its own.
4. **Wrong UML** — if you drew this as `Order ──◆ Customer`, the interviewer would immediately call it out.

The right relationship here is **Aggregation**: a Customer exists independently and an Order *holds a reference* to one.

---

## 4. Good Code Example — Each Relationship in TypeScript

Here is one mini-system showing all six relationships cleanly. Read the comments — they're what you'd say out loud while drawing.

```ts
// ============================================================
// 1) INHERITANCE  (User <|── Customer)
// ============================================================
abstract class User {
  constructor(public readonly id: string, public name: string) {}
  abstract role(): string;
}

class Customer extends User {
  role() { return "customer"; }
}

// ============================================================
// 2) REALIZATION  (PaymentGateway <|.. StripeGateway)
// ============================================================
interface PaymentGateway {
  charge(amount: number): Promise<string>; // returns txn id
}

class StripeGateway implements PaymentGateway {
  async charge(amount: number) { return `stripe_txn_${Date.now()}`; }
}

// ============================================================
// 3) COMPOSITION  (Order ◆── OrderItem)
// OrderItems are MEANINGLESS without their parent Order.
// The Order creates them, owns them, and they die with it.
// ============================================================
class OrderItem {
  constructor(
    public readonly sku: string,
    public readonly qty: number,
    public readonly price: number
  ) {}
}

// ============================================================
// 4) AGGREGATION  (Order ◇── Customer)
// Order REFERS TO an existing Customer. The Customer was created
// elsewhere and will outlive any single Order.
// ============================================================
class Order {
  private items: OrderItem[] = [];

  constructor(
    public readonly id: string,
    private customer: Customer  // aggregation: passed in, not created here
  ) {}

  addItem(sku: string, qty: number, price: number) {
    // composition: Order CREATES the OrderItem internally
    this.items.push(new OrderItem(sku, qty, price));
  }

  total() {
    return this.items.reduce((s, i) => s + i.qty * i.price, 0);
  }

  // ============================================================
  // 5) DEPENDENCY  (Order ..> PaymentGateway)
  // Order doesn't store a PaymentGateway as a field. It uses one
  // briefly inside this single method, then forgets about it.
  // Drawn as a dashed arrow.
  // ============================================================
  async checkout(gateway: PaymentGateway): Promise<string> {
    return gateway.charge(this.total());
  }
}

// ============================================================
// 6) ASSOCIATION  (Customer ── Address)
// Plain structural link: Customer has-a Address it knows about,
// but neither owns the other strictly. Often used when you don't
// want to over-specify aggregation vs composition early on.
// ============================================================
class Address {
  constructor(public line1: string, public city: string) {}
}

interface CustomerWithAddress extends Customer {
  address: Address;
}
```

How you'd narrate this UML in an interview:

> "Customer extends User — that's inheritance. StripeGateway realizes the PaymentGateway interface. An Order is composed of OrderItems — filled diamond, because items don't exist outside an order. An Order aggregates a Customer — open diamond, because the customer outlives the order. The Order depends on PaymentGateway only at checkout time — dashed arrow, because it's a method-scoped use. And Customer has a plain association to Address."

That single paragraph wins you a lot of points before you've written a line of code.

---

## 5. Real-world Use Case

**E-commerce checkout (Amazon-style):**

* `Order ──◆ OrderItem` — composition. Cancel the order, the line items go with it. They have no meaning standalone.
* `Order ──◇ Customer` — aggregation. The customer exists in the user-service whether or not this order exists.
* `Order ──◇ ShippingAddress` — aggregation. Address is a saved entity the customer reuses.
* `Order ··> PaymentGateway` — dependency. Used only during `pay()`.
* `Order ──◇ Discount[]` — aggregation, multiplicity `0..*`. Discounts come from a campaign service.
* `OrderService ··> NotificationService` — dependency. Sends one event after checkout.

**React component tree** is another nice mental model: a `<Page>` *composes* its layout (children unmount with it), but it *aggregates* a global `UserContext` (logged-in user persists across pages).

**Database analogy:** composition ≈ rows that get cascade-deleted with the parent (`ON DELETE CASCADE`). Aggregation ≈ foreign key without cascade.

---

## 6. Interview Questions

### Q1. What's the difference between Aggregation and Composition? (Asked in 90% of LLD interviews)

**Answer:** Both express a "has-a" relationship, but the difference is **lifetime ownership**.

* In **composition**, the container *creates and owns* the parts. When the container is destroyed, the parts are destroyed too — they cannot exist independently. Example: `House` and `Room`.
* In **aggregation**, the container *references* parts that exist independently. The parts can outlive the container. Example: `University` and `Student`.

UML notation: composition uses a **filled** diamond, aggregation uses an **open** (hollow) diamond. In code, composition usually means the parent `new`s up the child internally; aggregation means the child is passed in via constructor / setter.

---

### Q2. When should I use Dependency vs Association in a class diagram?

**Answer:** Use **association** when the class *holds a long-lived reference* to another class — typically as a field. Use **dependency** when the class *uses* another class only transiently — as a method parameter, local variable, or return type — but doesn't store it.

Quick test: "Does this class have a field of that type?"

* Yes → Association (or its specialized forms, aggregation/composition).
* No, only in a method signature → Dependency (dashed arrow).

Example: `Order` has a `Customer` field → association. `Order.checkout(gateway)` takes a `PaymentGateway` parameter → dependency on PaymentGateway.

---

### Q3. Inheritance vs Realization — what's the UML difference and why does it matter?

**Answer:**

* **Inheritance** (extends): solid line with hollow triangle. Used between two classes when the child reuses behavior + state from the parent. `class Dog extends Animal`.
* **Realization** (implements): **dashed** line with hollow triangle. Used when a class fulfills the contract of an interface but inherits no implementation. `class StripeGateway implements PaymentGateway`.

Why interviewers care: realization signals that you're designing to interfaces (Dependency Inversion principle), which is what makes systems extensible. If your diagram has many dashed-triangle arrows pointing to interfaces, it screams "good design." If everything is solid-triangle inheritance from concrete classes, it screams "rigid hierarchy" and SOLID violations.

---

### Q4. Walk me through the UML for a Splitwise-style expense splitter.

**Answer:** (You'd talk while drawing.)

* `User` is a base class. (No subclasses needed unless you have admins / guests.)
* `Group ──◇ User [1..*]` — aggregation. Users exist outside groups.
* `Expense ──◇ User` (paidBy) — aggregation, single user.
* `Expense ──◆ Split [1..*]` — **composition**. A `Split` is meaningless without its parent expense; it gets deleted with the expense. Multiplicity 1..* (an expense has at least one split).
* `Split ──◇ User` — aggregation, the user who owes a portion.
* `SplitStrategy <|.. EqualSplit, ExactSplit, PercentSplit` — realization. Strategy pattern for how an expense is divided.
* `Expense ··> SplitStrategy` — dependency. Expense uses a strategy at creation to compute splits but doesn't own one long-term (the strategy is stateless and shared).
* `BalanceSheet ──◇ User` — aggregation. Tracks net owed amounts.

The key things the interviewer is checking: did you correctly use **composition for Split** (because Splits die with the Expense), **aggregation for User** (because users outlive expenses), and **realization** for the strategy interface (showing extensibility)?

---

### Q5. I see a class with 12 fields, all of which are other classes the parent `new`s up internally. What does that tell you about the design?

**Answer:** It tells me this class is doing way too much (SRP violation) **and** has hardcoded composition with all 12 dependencies, which makes it untestable and inflexible. In UML it would be a single class with twelve filled-diamond arrows pointing out of it — a "god class."

The fix is a mix of:

1. **Break it up** — extract several smaller classes, each with a single responsibility.
2. **Convert composition to aggregation/dependency** where the part *could* be supplied externally — i.e., **inject** it through the constructor instead of `new`-ing it. That immediately enables mocking in tests and lets the caller swap implementations (Dependency Inversion).
3. Composition is still fine when the part is genuinely an internal implementation detail (like `OrderItem` inside `Order`), but it should be a deliberate choice, not the default.

This question tests whether you understand that "filled diamond everywhere" is usually a smell, not a feature.

---

## TL;DR Cheat Sheet

```
Inheritance       ────▷  solid line, hollow triangle      "is-a"          (extends)
Realization       ----▷  dashed line, hollow triangle     "implements"    (implements)
Association       ────   plain solid line                 "knows-a"       (holds reference)
Aggregation       ────◇  solid line, open diamond         "has-a, weak"   (parts outlive whole)
Composition       ────◆  solid line, filled diamond       "has-a, strong" (parts die with whole)
Dependency        ----→  dashed line, open arrow          "uses-a"        (transient use in method)
```

Memorize this table. It's worth its weight in offers.
