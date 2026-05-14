# 17 — Factory Method Pattern

> Phase 4 — Design Patterns → Creational
> Pattern type: Creational
> Difficulty: Medium — easy to write, easy to over-engineer

---

## 1. Concept / Theory

A **Factory** centralizes object creation behind a single function/method. Instead of clients calling `new ConcreteClass()` directly, they ask a factory to produce the right object for them.

**Why does this matter?** Three reasons:

1. **Hides instantiation complexity.** The caller says "give me a payment processor for `'UPI'`" — it doesn't have to know which concrete class to construct, what arguments it needs, or which dependencies to wire up.
2. **Open/Closed Principle.** New types are added by extending the factory, not by editing every caller. This is the single biggest reason factories exist.
3. **Decoupling.** Callers depend on an *interface* (e.g. `PaymentProcessor`), not on the concrete class. This is Dependency Inversion in practice.

### Two patterns share the name "factory" — know the difference

This is the part candidates fumble. There are actually **three** related patterns:

| Pattern              | Mechanism                                                 | When to use                                  |
| -------------------- | --------------------------------------------------------- | -------------------------------------------- |
| **Simple Factory**   | One static method that returns the right subtype based on a key. **Not** an official GoF pattern but ubiquitous in real code. | The common case. 90% of interview answers.   |
| **Factory Method** (GoF) | A *creator* class declares an abstract factory method; *subclasses* override it to produce different products. | When the *whole creator* varies per product family. |
| **Abstract Factory** (next lesson) | An interface that produces *families* of related objects. | When products come in matched sets.          |

In an interview, when someone says "implement Factory" they usually mean **Simple Factory**. When the textbook (GoF) says Factory Method, they specifically mean the *subclass-overrides-the-creator* version. Both are valid; just be ready to distinguish them.

### Structure of GoF Factory Method

```
        ┌──────────────┐                     ┌──────────────┐
        │   Creator    │ ◇──── creates ────▷ │   Product    │  (interface)
        │ + factoryM() │                     └──────────────┘
        └──────┬───────┘                            △
               △                                    │
   ┌───────────┴──────────┐               ┌─────────┴─────────┐
   │  ConcreteCreatorA    │ ────creates──▷│  ConcreteProductA │
   │  + factoryM()        │               └───────────────────┘
   └──────────────────────┘
```

The Creator's factoryMethod() is *abstract*; each subclass returns a different concrete Product. The Creator itself can have other methods that *use* whatever the factory method returns — that's the magic, the base class is written in terms of the abstract product.

---

## 2. Real-life Analogy

A **pizza chain**. You walk into any branch and order "a Margherita." The store handles which oven, which dough recipe, which cheese supplier — you don't care. That's a **simple factory**: one counter, dispatching to the right pizza maker based on your input.

Now imagine the chain has different *kinds* of branches: a NY-style branch and a Chicago-style branch. Both let you order "a Margherita," but each produces a different pizza because the *whole branch* is different. That's **GoF Factory Method**: the Creator (the branch) is subclassed, and each subclass overrides `makePizza()`.

Real-world equivalent in code: `document.createElement("div")` is a simple factory — one method, many products. The DOM `Document` class itself is a creator; an `HTMLDocument` and an `XMLDocument` would override how elements are constructed — that's Factory Method.

---

## 3. Bad Code Example — Scattered `new` + `switch`

This is what code looks like before someone introduces a factory. The same dispatch logic is duplicated in three places, and adding a new payment type requires editing all of them.

```ts
// ❌ BAD: every caller knows about every concrete class
class CheckoutController {
  pay(method: string, amount: number) {
    let processor;
    if (method === "card")      processor = new CardProcessor("stripe-key", "v2");
    else if (method === "upi")  processor = new UPIProcessor("merchant-id");
    else if (method === "paypal") processor = new PayPalProcessor("client-id", "secret");
    else throw new Error("Unknown payment method");
    return processor.charge(amount);
  }
}

class SubscriptionRenewer {
  renew(method: string, plan: Plan) {
    let processor;
    // SAME switch, copy-pasted
    if (method === "card")      processor = new CardProcessor("stripe-key", "v2");
    else if (method === "upi")  processor = new UPIProcessor("merchant-id");
    else if (method === "paypal") processor = new PayPalProcessor("client-id", "secret");
    else throw new Error("Unknown payment method");
    return processor.charge(plan.price);
  }
}

class RefundService {
  // ...same switch a third time
}
```

What's wrong:

1. **OCP violation.** Adding `ApplePayProcessor` means editing `CheckoutController`, `SubscriptionRenewer`, AND `RefundService`. The "open for extension, closed for modification" rule is broken in three places.
2. **Knowledge leak.** Every caller knows the constructor signatures of every concrete processor (`stripe-key`, `merchant-id`, `client-id+secret`). If `CardProcessor`'s constructor changes, all callers break.
3. **DIP violation.** High-level callers (controllers, services) depend on low-level concretes (`CardProcessor`, `UPIProcessor`).
4. **Testing nightmare.** Mocking is hard because the `new` calls are inline.

---

## 4. Good Code Example — Two Flavors in TypeScript

### 4a. Simple Factory (the everyday version)

This is what you should reach for first in an interview unless they specifically ask for GoF Factory Method.

```ts
// 1) The product interface — callers depend ONLY on this
interface PaymentProcessor {
  charge(amount: number): Promise<string>; // returns transaction id
}

// 2) The concrete products
class CardProcessor implements PaymentProcessor {
  constructor(private apiKey: string, private apiVersion: string) {}
  async charge(amount: number) { return `card_txn_${amount}`; }
}

class UPIProcessor implements PaymentProcessor {
  constructor(private merchantId: string) {}
  async charge(amount: number) { return `upi_txn_${amount}`; }
}

class PayPalProcessor implements PaymentProcessor {
  constructor(private clientId: string, private secret: string) {}
  async charge(amount: number) { return `paypal_txn_${amount}`; }
}

// 3) The factory — the only place that knows about concrete classes
type PaymentMethod = "card" | "upi" | "paypal";

class PaymentProcessorFactory {
  static create(method: PaymentMethod): PaymentProcessor {
    switch (method) {
      case "card":   return new CardProcessor(process.env.STRIPE_KEY!, "v2");
      case "upi":    return new UPIProcessor(process.env.MERCHANT_ID!);
      case "paypal": return new PayPalProcessor(process.env.PP_CLIENT!, process.env.PP_SECRET!);
      default: {
        const _exhaust: never = method;       // TS exhaustiveness check
        throw new Error(`Unknown method: ${_exhaust}`);
      }
    }
  }
}

// 4) Callers no longer know about concretes
class CheckoutController {
  pay(method: PaymentMethod, amount: number) {
    const processor = PaymentProcessorFactory.create(method);
    return processor.charge(amount);
  }
}

class SubscriptionRenewer {
  renew(method: PaymentMethod, plan: { price: number }) {
    const processor = PaymentProcessorFactory.create(method);
    return processor.charge(plan.price);
  }
}
```

What changed:

* Adding `ApplePayProcessor` now means: write the class, add one case to the factory. **No caller changes.**
* Callers depend on `PaymentProcessor` (the interface). Pure DIP.
* The `never` exhaustiveness pattern means TS will *fail to compile* if you forget a case after extending the union — a free safety net.

### 4b. GoF Factory Method (creator-subclass version)

Use this when the *creator* itself varies — i.e., the whole class that *produces* the product is what's being subclassed. Classic example: cross-platform UI components.

```ts
// Product
interface Button {
  render(): string;
  onClick(handler: () => void): void;
}

// Concrete products
class WindowsButton implements Button {
  render() { return "<windows-button/>"; }
  onClick(h: () => void) { /* hook into Win32 events */ }
}
class MacButton implements Button {
  render() { return "<mac-button/>"; }
  onClick(h: () => void) { /* hook into Cocoa events */ }
}

// Creator — declares the factory method abstractly
abstract class Dialog {
  abstract createButton(): Button;            // ← the factory method

  // The interesting bit: Dialog uses the product without knowing the concrete type
  render(): string {
    const okBtn = this.createButton();
    okBtn.onClick(() => console.log("ok"));
    return `<dialog>${okBtn.render()}</dialog>`;
  }
}

// Concrete creators
class WindowsDialog extends Dialog {
  createButton() { return new WindowsButton(); }
}
class MacDialog extends Dialog {
  createButton() { return new MacButton(); }
}

// Usage
const dialog: Dialog = process.platform === "darwin" ? new MacDialog() : new WindowsDialog();
console.log(dialog.render());
// Mac:    <dialog><mac-button/></dialog>
// Win:    <dialog><windows-button/></dialog>
```

The base `Dialog.render()` works for both platforms — it never mentions `WindowsButton` or `MacButton`. The variation is encapsulated in the overridden factory method.

This is what the GoF book actually means by "Factory Method." If an interviewer asks for the textbook version, give them this.

### 4c. Registry-style factory (production-grade)

In real codebases, the `switch` becomes a registry, so factories themselves are open for extension:

```ts
type Creator = () => PaymentProcessor;

class PaymentRegistry {
  private static creators = new Map<string, Creator>();

  static register(method: string, creator: Creator) {
    this.creators.set(method, creator);
  }

  static create(method: string): PaymentProcessor {
    const creator = this.creators.get(method);
    if (!creator) throw new Error(`Unknown method: ${method}`);
    return creator();
  }
}

// Each module registers itself
PaymentRegistry.register("card",   () => new CardProcessor("k", "v2"));
PaymentRegistry.register("upi",    () => new UPIProcessor("m"));
PaymentRegistry.register("paypal", () => new PayPalProcessor("c", "s"));
// later, plugins can do: PaymentRegistry.register("applepay", () => new ApplePayProcessor());

const p = PaymentRegistry.create("upi");
```

Drop this in if the interviewer asks "how would you make the factory itself extensible?"

---

## 5. Real-world Use Cases

* **`document.createElement("div")`** — a simple factory in the DOM. The browser hides the fact that `<div>` is `HTMLDivElement` and `<table>` is `HTMLTableElement`.
* **`React.createElement(type, props, ...children)`** — JSX desugars to this factory call.
* **`new Date(...)`** — JS itself uses overloaded factory-like behavior; libraries like dayjs/date-fns wrap it.
* **Logger frameworks** — `LoggerFactory.getLogger("MyClass")` decides whether to give you a console logger, file logger, or remote logger based on config.
* **Database drivers** — `mongoose.createConnection(uri)`, `new Pool({...})` are factory-like.
* **Payment gateways** — exactly the example above; every checkout system has some flavor of it.
* **Notification senders** — `NotificationFactory.create("email" | "sms" | "push")` returning the right channel.
* **AWS SDK clients** — `new S3Client(config)` is straightforward, but `DynamoDBDocument.from(client)` is a factory that wraps a low-level client into a higher-level one.
* **Dependency Injection containers** — at heart, a DI container is a giant factory registry.

---

## 6. Interview Questions

### Q1. What's the difference between Simple Factory, Factory Method, and Abstract Factory?

**Answer:**

* **Simple Factory** — one class with one (often static) method that returns different concrete products based on a parameter. Not an official GoF pattern but the most common in real code. Adding a new product requires editing the factory.
* **Factory Method** (GoF) — a creator class with an abstract factory method that *subclasses override* to produce different products. The variation lives in the creator hierarchy. Adding a new product means adding a new creator subclass — no edits to existing creators.
* **Abstract Factory** — an interface that produces *families* of related products (e.g., a UI factory that creates buttons, checkboxes, and menus all matching one theme). Often implemented internally using Factory Methods.

A good way to remember it: Simple Factory makes one product type; Factory Method varies *who* makes it; Abstract Factory makes *sets* of related products.

---

### Q2. Why use a factory instead of just calling `new`?

**Answer:** Three reasons, in order of importance:

1. **Decoupling.** Callers stop depending on concrete classes. They depend on the product interface and the factory function. You can swap implementations (real ↔ mock, v1 ↔ v2) by changing one line.
2. **Open/Closed.** Adding a new variant is one new class + one new line in the factory. No caller changes.
3. **Hiding construction complexity.** Some objects need 5 dependencies and a config blob to construct; a factory lets callers say "give me a card processor" without knowing the recipe.

If none of those apply — if you're constructing a single-use object with two args and no variation — using `new` directly is fine. Don't over-engineer.

---

### Q3. How does Factory Method relate to the Open/Closed Principle?

**Answer:** It's the canonical example. OCP says modules should be *open for extension* but *closed for modification*. With a factory, when a new product type appears (`ApplePayProcessor`), you:

* **Extend** by adding the new class.
* **Don't modify** any caller — only the factory itself gets a new case (or a new entry if you used the registry pattern).

In the registry-based factory above, even the factory class isn't modified — you just call `register()` from a new module. That's *fully* OCP-compliant: you can add behavior without editing existing files at all.

---

### Q4. Design a notification system using Factory Method. Walk through it.

**Answer:** Start with a `Notifier` interface:

```ts
interface Notifier {
  send(userId: string, message: string): Promise<void>;
}
```

Concrete classes: `EmailNotifier`, `SmsNotifier`, `PushNotifier`, `SlackNotifier`. Each takes its own dependencies (mailer, Twilio client, FCM client, Slack webhook) in the constructor.

A `NotifierFactory.create(channel: Channel)` returns the right one. Callers (e.g., `OrderService.notifyShipped`) take a `Notifier` from the factory based on the user's preference and send.

```ts
class OrderService {
  constructor(private notifierFactory: typeof NotifierFactory) {}
  async notifyShipped(user: User, orderId: string) {
    const notifier = this.notifierFactory.create(user.preferredChannel);
    await notifier.send(user.id, `Order ${orderId} shipped`);
  }
}
```

Extension points to *mention proactively*:

* Adding `WhatsAppNotifier` is one new class + one factory entry. No `OrderService` change.
* For multi-channel (email *and* SMS), wrap with a `CompositeNotifier` that fans out — Composite pattern on top of the factory.
* For retries, wrap with a `RetryingNotifier` — Decorator pattern on top.

That last bit — anticipating extensions — is what separates a 4/5 from a 5/5 in the rubric.

---

### Q5. Doesn't a Factory just shift the `switch` from many places to one place? What's actually gained?

**Answer:** Yes, the switch still exists. What's gained is:

1. **The switch lives in *one place*.** When a new variant is added, you change one file. Without the factory, the switch is duplicated across every caller.
2. **Callers no longer know concrete types or their constructor arguments.** `CheckoutController` doesn't know that `CardProcessor` needs a `stripe-key` and an `apiVersion`. That isolation is huge for refactors.
3. **You can replace the switch later.** With a registry-based factory, the dispatch isn't even a switch anymore — it's a `Map.get()`. You couldn't make that swap if dispatch logic was inlined in 50 callsites.
4. **Polymorphism replaces conditionals at the call site.** Callers do `processor.charge(amount)` — uniform interface, no `if` ladder. The conditional is concentrated in the factory and never seen again.

So the factory isn't *eliminating* the conditional — it's *quarantining* it. That's the win.

---

## TL;DR Cheat Sheet

```
Simple Factory:        one method, returns the right concrete based on a key
Factory Method (GoF):  abstract method on a creator class; subclasses override it
Abstract Factory:      makes families of related products (next lesson)
Registry-based:        Map<string, () => Product> — fully OCP-compliant

Use when:
  - Multiple concrete implementations of one interface
  - Adding new ones is expected
  - Callers shouldn't know construction details

Don't use when:
  - Only one implementation (YAGNI)
  - Construction is trivial (`new X(a)`)

Interview gold:
  - Mention exhaustiveness check (`never`)
  - Mention registry-based factory for full OCP
  - Distinguish Simple Factory vs GoF Factory Method clearly
```
