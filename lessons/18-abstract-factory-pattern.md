# 18 — Abstract Factory Pattern

> Phase 4 — Design Patterns → Creational
> Pattern type: Creational
> Difficulty: Medium-hard — easy to confuse with Factory Method, easy to over-engineer

---

## 1. Concept / Theory

**Abstract Factory** provides an interface for creating *families of related products* without specifying their concrete classes. The client picks one factory; everything that factory produces is guaranteed to belong to the same family.

The defining feature: **multiple `create*` methods on one factory**, each returning a different *kind* of product, and all the products from one factory are designed to **work together**.

```
                ┌─────────────────────────┐
                │  AbstractFactory        │
                │ + createButton()        │
                │ + createCheckbox()      │
                │ + createDialog()        │
                └────────────┬────────────┘
                             △
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ MacFactory   │      │ WinFactory   │      │ LinuxFactory │
│ + createBtn  │      │ + createBtn  │      │ + createBtn  │
│ + createChk  │      │ + createChk  │      │ + createChk  │
│ + createDlg  │      │ + createDlg  │      │ + createDlg  │
└──────────────┘      └──────────────┘      └──────────────┘
```

Each concrete factory produces a *complete, consistent* set: a Mac button + Mac checkbox + Mac dialog, never mixed with Windows ones.

### Why this exists — the consistency invariant

The whole point of Abstract Factory is that **mixing products from different families is a bug**. A "Mac button" rendered inside a "Windows dialog" would look broken. Abstract Factory makes this impossible at the type level — once you've chosen the `MacFactory`, every `create*` it returns belongs to the Mac family.

### How it differs from Factory Method (the most-asked interview question)

* **Factory Method** has *one* product type. Subclasses of the creator override one factory method to vary which concrete product is returned.
* **Abstract Factory** has *multiple* product types that go together. Each concrete factory implements all the create methods to produce one matched family.

A handy mental model: a Factory Method makes one shoe; an Abstract Factory makes a matching outfit (shoes + shirt + pants — all in the same style).

### The famous trade-off

Abstract Factory is **easy to extend with new families** (just add `LinuxFactory`) but **hard to extend with new product types** (adding `createTooltip()` means updating *every* concrete factory). This is sometimes called the "open for new families, closed for new products" problem. Mention this in interviews — it's a maturity signal.

---

## 2. Real-life Analogy

A **furniture showroom** sells matching sets. The "Modern" collection has a modern sofa, modern chair, and modern table. The "Victorian" collection has Victorian versions of all three. You walk in and pick a *collection*; whatever pieces you buy are guaranteed to match.

If you tried to buy a Modern sofa and a Victorian table, the showroom literally won't let you — they're sold as sets. That's exactly what Abstract Factory enforces in code.

Another nice analogy: **Apple's design system**. macOS Sonoma's window chrome, button styles, scrollbars, sliders — all designed to look consistent. Sonoma's `UIFactory` produces all of them. Big Sur's `UIFactory` produces an older, slightly different set. You don't accidentally mix Sonoma sliders with Big Sur buttons.

---

## 3. Bad Code Example — Mixing Families By Accident

What goes wrong without Abstract Factory: nothing stops a caller from constructing inconsistent combinations.

```ts
// ❌ BAD: themes are just strings, components are picked individually
class DarkButton {
  render() { return "<button bg=#000 fg=#fff/>"; }
}
class LightButton {
  render() { return "<button bg=#fff fg=#000/>"; }
}
class DarkDialog {
  constructor(private btn: DarkButton | LightButton) {}
  render() { return `<dialog bg=#111>${this.btn.render()}</dialog>`; }
}
class LightDialog {
  constructor(private btn: DarkButton | LightButton) {}
  render() { return `<dialog bg=#eee>${this.btn.render()}</dialog>`; }
}

// somewhere in the app...
function buildLoginScreen(theme: "dark" | "light") {
  const button = theme === "dark" ? new DarkButton() : new LightButton();
  // OOPS — pulled the dialog from the WRONG branch
  const dialog = theme === "dark" ? new LightDialog(button) : new DarkDialog(button);
  //                                  ^^^^^^^^^^^^^^^                    ^^^^^^^^^^^^
  // a Dark button inside a Light dialog. Visually broken. TS allows it.
  return dialog.render();
}
```

What's wrong:

1. **No type-level guarantee that the family is consistent.** TS happily lets `DarkDialog` accept a `LightButton`.
2. **Switch-on-theme logic scattered everywhere.** Every screen that builds UI has its own `if (theme === ...)` ladder, and any one of them can drift.
3. **Adding a new theme** (e.g., "high-contrast") means editing every screen that constructs UI, just like the bad version of Factory Method.
4. **Adding a new component type** (e.g., Tooltip) means *every screen* now needs to know about Tooltip and how to pick the right variant.

A bug like the one above (`DarkButton` in a `LightDialog`) is the *exact* class of bug Abstract Factory prevents.

---

## 4. Good Code Example — Abstract Factory in TypeScript

We'll model a UI theme system with two product types (Button, Dialog) and two themes (Dark, Light).

```ts
// ============================================================
// 1) Abstract Products — interfaces for each product type
// ============================================================
interface Button {
  render(): string;
}
interface Dialog {
  render(): string;
}

// ============================================================
// 2) Concrete Products — Dark family
// ============================================================
class DarkButton implements Button {
  render() { return "<button bg=#000 fg=#fff/>"; }
}
class DarkDialog implements Dialog {
  constructor(private btn: Button) {}
  render() { return `<dialog bg=#111>${this.btn.render()}</dialog>`; }
}

// ============================================================
// 3) Concrete Products — Light family
// ============================================================
class LightButton implements Button {
  render() { return "<button bg=#fff fg=#000/>"; }
}
class LightDialog implements Dialog {
  constructor(private btn: Button) {}
  render() { return `<dialog bg=#eee>${this.btn.render()}</dialog>`; }
}

// ============================================================
// 4) The Abstract Factory
// ============================================================
interface UIFactory {
  createButton(): Button;
  createDialog(button: Button): Dialog;
}

// ============================================================
// 5) Concrete Factories — each returns a complete, consistent family
// ============================================================
class DarkUIFactory implements UIFactory {
  createButton(): Button { return new DarkButton(); }
  createDialog(btn: Button): Dialog { return new DarkDialog(btn); }
}

class LightUIFactory implements UIFactory {
  createButton(): Button { return new LightButton(); }
  createDialog(btn: Button): Dialog { return new LightDialog(btn); }
}

// ============================================================
// 6) Client — depends ONLY on the abstract factory + product interfaces
// ============================================================
class LoginScreen {
  constructor(private ui: UIFactory) {}

  render() {
    const button = this.ui.createButton();
    const dialog = this.ui.createDialog(button);  // guaranteed same family
    return dialog.render();
  }
}

// ============================================================
// 7) Composition Root — the ONLY place that picks a concrete factory
// ============================================================
function getFactory(theme: "dark" | "light"): UIFactory {
  return theme === "dark" ? new DarkUIFactory() : new LightUIFactory();
}

const screen = new LoginScreen(getFactory("dark"));
console.log(screen.render());
// → <dialog bg=#111><button bg=#000 fg=#fff/></dialog>
//   guaranteed consistent. No way to mix dark + light by accident.
```

What this buys you:

* **`LoginScreen` has zero `if (theme === ...)` logic.** It works for any theme that ships a `UIFactory` implementation.
* **Adding a new theme** (e.g. `HighContrastUIFactory`) is one new file with three classes — no existing screen changes.
* **The "dark button inside light dialog" bug is impossible** if you go through the factory. The factory hands you a matched pair every time.
* **Testability:** in tests, pass a `MockUIFactory` that returns spy components.

### What if you want a third product type?

Say we now want a `Checkbox`. This is the famous Abstract Factory weakness:

```ts
interface UIFactory {
  createButton(): Button;
  createDialog(button: Button): Dialog;
  createCheckbox(): Checkbox;   // ← new method
}
```

Now **every** existing concrete factory (`DarkUIFactory`, `LightUIFactory`, ...) breaks until they implement `createCheckbox()`. This is the Abstract Factory tax: easy to add families, hard to add product types. Be ready to articulate this in interviews.

---

## 5. Real-world Use Cases

* **Cross-platform UI frameworks** — React Native renders to UIKit on iOS and to Android Views on Android. Internally there's a factory abstraction picking the right native component implementation.
* **MUI / Chakra theme system** — the `<ThemeProvider>` is an abstract-factory wrapper that ensures every component reads from the *same* theme tokens.
* **Database drivers (JDBC / TypeORM / Sequelize)** — choose a dialect (`mysql`, `postgres`, `sqlite`) and you get a matched set of `Connection`, `QueryBuilder`, `Migrator` — all speaking that dialect.
* **AWS SDK regional clients** — `S3Client({region: "us-east-1"})` and `DynamoDBClient({region: "us-east-1"})` — when you bundle these, you can think of "the region" as the family.
* **Game engines** — DirectX renderer family vs OpenGL renderer family vs Vulkan renderer family. Each has its own `Texture`, `Shader`, `Mesh` types; you pick a renderer and get all matching pieces.
* **Authentication providers** — pick a provider (Auth0, Clerk, Firebase) and get a matched set of `Login`, `Signup`, `PasswordReset` flows that all speak its protocol.
* **PDF/HTML/Markdown report generators** — one `ReportFactory` produces matched `Header`, `Body`, `Footer` renderers all targeting the same output format.

In your day-to-day frontend work at Magnifi, the most direct parallel is **theme/skin systems**. Every well-designed component library uses Abstract Factory under the hood, even if it's hidden behind a context provider.

---

## 6. Interview Questions

### Q1. What's the difference between Factory Method and Abstract Factory?

**Answer:** Both create objects via interfaces, but they operate at different scales.

* **Factory Method** — *one* product type. The creator class has *one* abstract factory method that subclasses override. Different creators produce different concrete versions of the *same* product.
* **Abstract Factory** — *multiple related* product types that form a family. The factory interface has *several* create methods, each producing a different kind of product. All products from one concrete factory are guaranteed to match.

Mental model: Factory Method makes one shoe; Abstract Factory makes a matching outfit.

In implementation, an Abstract Factory is often *built using* multiple Factory Methods — each `create*` method on the factory is itself a Factory Method.

---

### Q2. When should I reach for Abstract Factory? When is it overkill?

**Answer:** Reach for it when **all** of these are true:

1. You have **multiple kinds** of products (more than one create method's worth).
2. The products from one family must **work together**; mixing across families is a bug.
3. You expect **multiple families** that might grow over time.

If you only have one product type, you want Factory Method (or Simple Factory), not Abstract Factory.

It's overkill when:

* There's only one family today and you're speculating about future ones — YAGNI.
* The "products" are simple data objects with no behavior — you don't need a factory at all, just configuration.
* You'd be creating a new factory class to wrap a single `new` call — just call `new`.

The smell is when an Abstract Factory has only one concrete implementation that ever gets used — that's pure architectural decoration.

---

### Q3. What's the main weakness of Abstract Factory?

**Answer:** It's easy to add new *families*, hard to add new *product types*. Adding a new family means writing one new factory class — no existing code changes. But adding a new product type (e.g., `Tooltip` to a UI factory) means modifying every existing factory class, because they all need to implement `createTooltip()`.

This is the inverse of the Factory Method weakness, where each new product type means a new creator subclass.

In practice, you mitigate this by:

1. **Provide a base abstract class with default `throw new Error("not supported")` implementations**, so adding new methods doesn't *immediately* break older factories.
2. **Split the factory into smaller interfaces** (Interface Segregation) so factories only need to implement the parts relevant to them.
3. **Accept the cost upfront** if you genuinely have stable product types and unstable families (which is common — you tend to know what *kinds* of UI components you need before you know all the themes).

---

### Q4. Walk me through how you'd design a multi-tenant SaaS that supports multiple databases (Postgres, MySQL, MongoDB) using Abstract Factory.

**Answer:** Each tenant configures a database. The system needs to talk to it through a uniform interface, but each DB has different drivers, query builders, and schema migrators.

The abstract factory:

```ts
interface DBFactory {
  createConnection(): DBConnection;
  createQueryBuilder(): QueryBuilder;
  createMigrator(): Migrator;
}
```

Three concrete factories: `PostgresDBFactory`, `MySQLDBFactory`, `MongoDBFactory`. Each creates the matched trio for its dialect.

The application layer depends only on `DBFactory` and the product interfaces:

```ts
class TenantService {
  constructor(private dbFactory: DBFactory) {}
  async createUser(name: string) {
    const conn = this.dbFactory.createConnection();
    const qb = this.dbFactory.createQueryBuilder();
    return conn.execute(qb.insert("users").values({ name }));
  }
}
```

At bootstrap, we read each tenant's config and instantiate the right factory:

```ts
function factoryFor(tenant: Tenant): DBFactory {
  switch (tenant.dbDialect) {
    case "postgres": return new PostgresDBFactory(tenant.dbUrl);
    case "mysql":    return new MySQLDBFactory(tenant.dbUrl);
    case "mongo":    return new MongoDBFactory(tenant.dbUrl);
  }
}
```

The interviewer's likely follow-ups, and how I'd handle them:

* **"How do you add CockroachDB?"** — One new factory + one switch entry. Zero changes to `TenantService`. That's the OCP win.
* **"What if Mongo doesn't have a SQL-style QueryBuilder?"** — Two options: (a) make `QueryBuilder` abstract enough that a "Mongo aggregation builder" can implement it; (b) split into `RelationalDBFactory` and `DocumentDBFactory` if the abstraction is leaking too much. I'd lean toward (b) when the contracts genuinely diverge — forcing one interface on incompatible models is a classic LSP violation.
* **"What if migrations need to run on app start?"** — Each factory's migrator implements the same `migrate()` method; the bootstrap calls `factory.createMigrator().migrate()` once per tenant.

---

### Q5. Suppose I have an Abstract Factory and a Singleton — should each concrete factory be a Singleton?

**Answer:** Often yes — and usually the answer is "do it lazily through the composition root, not through an enforced Singleton class."

The reasoning: factories are typically stateless or hold light config. There's no need to construct a new `PostgresDBFactory` every time someone wants a query builder. So you create *one* per family in the bootstrap and inject it everywhere.

In code:

```ts
// composition root
const factory: DBFactory = new PostgresDBFactory(env.DB_URL);
const tenantService = new TenantService(factory);
const reportService = new ReportService(factory);
```

You don't need to mark `PostgresDBFactory` as a literal Singleton class with a `getInstance()` — the constraint is enforced by the bootstrap creating only one. That's the pattern I'd argue for; it gets you Singleton's "one instance" behavior without Singleton's downsides (global state, untestability).

The exception is when the factory caches expensive resources internally (like an ODBC driver handle). In that case the factory needs to literally be a Singleton, because constructing two would double-up resource consumption.

---

## TL;DR Cheat Sheet

```
Abstract Factory: one factory, multiple create methods, matched product family

Use when:
  - Several product types that must be used together
  - Multiple families exist and may grow

Strength:
  - Easy to add new family (one new factory class)
  - Type-level guarantee that products are consistent

Weakness:
  - Hard to add new product type (every factory must update)

vs Factory Method:
  - Factory Method  = 1 product, varies by creator subclass
  - Abstract Factory = N products in matched families

Real-world: theme systems, DB driver families, cross-platform UI,
            game engine renderers, multi-tenant SaaS configs
```
