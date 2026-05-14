# 19 — Builder Pattern

> Phase 4 — Design Patterns → Creational
> Pattern type: Creational
> Difficulty: Easy to write, very practical

---

## 1. Concept / Theory

**Builder** separates the construction of a complex object from its representation, letting you build it **step by step**. The same construction process can produce different results.

You reach for Builder when an object has:

* **Many optional parameters** — and you want named, readable construction.
* **A multi-step assembly process** — where some parts depend on others.
* **Multiple representations** — same recipe, different output formats (HTML report vs PDF report).
* **Validation rules that fire only at the end** — partial states should never be exposed.

The textbook problem Builder solves is the **telescoping constructor**:

```ts
new Pizza("medium", "thin", true, true, false, true, ["mushroom", "olive"], false, "well-done");
//        ^size    ^crust  ^cheese ^pepperoni            ^toppings              ^extraSauce
// what does each argument mean? you can't tell from the call site.
```

A builder turns that into:

```ts
new PizzaBuilder()
  .size("medium")
  .crust("thin")
  .addTopping("mushroom")
  .addTopping("olive")
  .extraCheese()
  .build();
```

Same object, infinitely more readable, and you can choose exactly which fields to set.

### Two flavors of Builder

#### a) Fluent Builder (modern, by far the most common)

Each method returns `this` so calls can be chained. The final `build()` returns the constructed object. This is the version you'll see and write 99% of the time.

#### b) GoF Builder with Director (the textbook version)

A `Builder` interface defines steps; a `Director` class knows the *recipe* — i.e., the order of steps to call. The same Builder under different Directors produces different products. Useful when you want to reuse construction recipes (e.g., "build a sports car" vs "build an SUV" both delegating to a `CarBuilder`).

In modern code, Directors are rare — recipe knowledge usually lives in the caller. Mention Directors in interviews as the textbook completeness, but use the fluent form in practice.

### What Builder is *not*

It's not just "any constructor with many parameters." If you have 3 mandatory args and that's it, use a constructor — don't build a builder. Reach for Builder when readability or step ordering genuinely needs help.

---

## 2. Real-life Analogy

A **Subway sandwich**:

1. Pick the bread.
2. Pick the meat.
3. Toast or no.
4. Pick the veggies (any subset).
5. Pick the sauces (any subset).
6. They wrap it up and hand you the finished sandwich.

You're walking through a well-defined sequence of choices, each independent, with sensible defaults. That's exactly the Builder ergonomic. You couldn't do this with a single constructor — you'd be stuck with `new Sandwich("italianHerbs", "turkey", true, ["lettuce", "tomato", "onion", "olives"], ["mayo", "mustard"])` and praying you got the argument order right.

Other analogies: a **car configurator** on a manufacturer's website (pick trim, pick color, pick interior, pick wheels, see price update); a **resume builder** (add education, add experience, add skills — all optional and reorderable).

---

## 3. Bad Code Example — Telescoping Constructor

This is the anti-pattern Builder fixes. You start with a small constructor, then add optional parameters one by one, and end up with a horror.

```ts
// ❌ BAD: 10-parameter constructor with mostly-optional fields
class HttpRequest {
  constructor(
    public url: string,
    public method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    public headers: Record<string, string> = {},
    public body?: string,
    public timeoutMs: number = 30_000,
    public retries: number = 0,
    public retryBackoffMs: number = 100,
    public followRedirects: boolean = true,
    public maxRedirects: number = 5,
    public proxy?: string,
  ) {}
}

// callers
const r1 = new HttpRequest(
  "https://api.example.com/users", "POST", { "Content-Type": "application/json" },
  JSON.stringify({ name: "Ayush" }), 5000, 3, 200, true, 5, undefined
);
//                                                        ^^^^^ what is this position again?
```

What's wrong:

1. **Unreadable call sites.** Every argument is a positional value with no name. You have to count commas or look up the constructor every time.
2. **Default-skip pain.** Want to set `proxy` but keep all other defaults? You have to re-pass *every* preceding default explicitly.
3. **Order coupling.** Adding a new option means picking a position; existing callers may misalign.
4. **No validation moment.** The object is "built" the instant the constructor is called, even if you forgot to set the body on a POST.
5. **Boolean traps.** `true, 5, undefined` at the end — what does each mean? You can't tell.

Some teams "fix" this by passing a single options object: `new HttpRequest({ url, method, ... })`. That helps with readability but loses the *step-by-step* ergonomics, can't enforce ordering, and validates everything in one place at the end. For simple cases, options objects are fine; for complex builds with conditional steps, full Builder wins.

---

## 4. Good Code Example — Builder in TypeScript

### 4a. Fluent Builder (the workhorse)

```ts
class HttpRequest {
  // fields are public-readonly so the built object is effectively immutable
  constructor(
    public readonly url: string,
    public readonly method: "GET" | "POST" | "PUT" | "DELETE",
    public readonly headers: Readonly<Record<string, string>>,
    public readonly body: string | undefined,
    public readonly timeoutMs: number,
    public readonly retries: number,
  ) {}
}

class HttpRequestBuilder {
  private url!: string;
  private method: "GET" | "POST" | "PUT" | "DELETE" = "GET";
  private headers: Record<string, string> = {};
  private body?: string;
  private timeoutMs = 30_000;
  private retries = 0;

  setUrl(url: string): this        { this.url = url; return this; }
  setMethod(m: HttpRequest["method"]): this { this.method = m; return this; }
  addHeader(k: string, v: string): this     { this.headers[k] = v; return this; }
  setBody(b: string): this         { this.body = b; return this; }
  setTimeout(ms: number): this     { this.timeoutMs = ms; return this; }
  setRetries(n: number): this      { this.retries = n; return this; }

  build(): HttpRequest {
    if (!this.url) throw new Error("url is required");
    if ((this.method === "POST" || this.method === "PUT") && !this.body) {
      throw new Error(`${this.method} requires a body`);
    }
    return new HttpRequest(
      this.url, this.method, { ...this.headers }, this.body, this.timeoutMs, this.retries
    );
  }
}

// usage
const req = new HttpRequestBuilder()
  .setUrl("https://api.example.com/users")
  .setMethod("POST")
  .addHeader("Content-Type", "application/json")
  .addHeader("Authorization", "Bearer xyz")
  .setBody(JSON.stringify({ name: "Ayush" }))
  .setTimeout(5000)
  .setRetries(3)
  .build();
```

Why this is better:

* **Self-documenting call sites.** Every value has a name.
* **Defaults are inside the builder**, not at every call site.
* **Validation at `build()`.** The half-constructed builder isn't exposed; the `HttpRequest` only exists in valid form.
* **Immutability.** The built object's fields are `readonly`. Once built, can't change.
* **`return this`** — the chaining magic.

### 4b. Step-enforced Builder (compile-time order)

If certain steps *must* happen before others (e.g. you must `setUrl()` before `build()`), you can encode that into the type system using "phantom types" — different builder types representing different completion stages.

```ts
class UrlMissingBuilder {
  setUrl(url: string): UrlSetBuilder { return new UrlSetBuilder(url); }
}
class UrlSetBuilder {
  private headers: Record<string, string> = {};
  constructor(private url: string) {}
  addHeader(k: string, v: string): this { this.headers[k] = v; return this; }
  build(): HttpRequest {
    return new HttpRequest(this.url, "GET", this.headers, undefined, 30_000, 0);
  }
}

const req2 = new UrlMissingBuilder()
  .setUrl("https://x.com")   // returns UrlSetBuilder
  .addHeader("a", "b")
  .build();

// new UrlMissingBuilder().build();
// ^ TS error: Property 'build' does not exist on type 'UrlMissingBuilder'.
```

The compiler refuses to let you call `build()` on an unfinished builder. Powerful but heavy — only worth it for high-stakes APIs (SDK design, public libraries). Mention it in interviews as a "if I needed type-level safety" option.

### 4c. GoF Builder with Director

For completeness, here's the textbook version where construction recipes live in a separate Director class.

```ts
interface PizzaBuilder {
  reset(): void;
  setDough(type: string): void;
  setSauce(type: string): void;
  addTopping(t: string): void;
  getResult(): Pizza;
}

class StandardPizzaBuilder implements PizzaBuilder {
  private pizza!: Pizza;
  reset() { this.pizza = new Pizza(); }
  setDough(t: string) { this.pizza.dough = t; }
  setSauce(t: string) { this.pizza.sauce = t; }
  addTopping(t: string) { this.pizza.toppings.push(t); }
  getResult() { return this.pizza; }
}

class PizzaDirector {
  // recipes
  buildMargherita(builder: PizzaBuilder) {
    builder.reset();
    builder.setDough("thin");
    builder.setSauce("tomato");
    builder.addTopping("mozzarella");
    builder.addTopping("basil");
  }
  buildHawaiian(builder: PizzaBuilder) {
    builder.reset();
    builder.setDough("regular");
    builder.setSauce("tomato");
    builder.addTopping("ham");
    builder.addTopping("pineapple");
  }
}

const builder = new StandardPizzaBuilder();
const director = new PizzaDirector();
director.buildMargherita(builder);
const margherita = builder.getResult();
```

The Director encapsulates the *recipe*; the Builder encapsulates the *construction mechanics*. Swap the builder, the same recipes produce e.g. a vegan version. In practice, this level of indirection is rarely worth it — recipes usually live with the caller.

---

## 5. Real-world Use Cases

* **SQL query builders** — Knex.js, Drizzle, Prisma's `db.user.findMany({...})` (less obviously a builder), Sequelize. `db.select("*").from("users").where("id", 1).orderBy("name").limit(10)`.
* **Test data factories** — `UserFactory.create().withEmail("x@y.com").asAdmin().build()`. Every backend test suite has these.
* **`StringBuilder` / `StringBuffer` (Java)** — JS doesn't need it because strings are different, but the pattern is the same: accumulate parts, finalize at the end.
* **Lodash `_.chain(...)` and RxJS `pipe(...)` chains** — fluent builders over data pipelines.
* **`URL` / `URLSearchParams`** — `params.append(k, v); params.append(k2, v2); url.search = params.toString()` is a builder used implicitly.
* **HTTP request libraries** — `axios.create({...}).get(url, opts)` — chained-config builders.
* **GraphQL query builders** — `gql.query.users.select({ id: true, name: true })`.
* **AWS CDK / Terraform CDK** — entire infrastructure-as-code DSLs are builders. `new Bucket(this, "MyBucket").grantRead(role).addEventNotification(...)`.
* **Form validation libraries** — `yup.string().email().required().min(3)`. Each method returns a refined schema; `.validate()` is the implicit `build()`.
* **React testing library / Cypress** — `cy.get(".btn").should("be.visible").click()`. Chained command builder.

The fluent style is dominant in modern JS/TS for one big reason: **types narrow as you chain**. Each call returns a more refined type, and your editor's autocomplete only shows valid next steps.

---

## 6. Interview Questions

### Q1. When would you use Builder over a constructor with an options object?

**Answer:** Both solve the "many parameters" problem; the choice depends on three things.

Use a **plain options object** (`new Thing({ a, b, c })`) when:

* Construction is one-shot — you have all values up front.
* No multi-step logic, no fields that depend on others.
* No need to enforce order or partial validity.

Use a **Builder** when:

* Construction is **incremental** — you set some values, do conditional logic, set more, then build.
* You need **validation that fires once**, after all setup.
* You want **method names that read like a workflow** (`addTopping().extraCheese().wellDone()`).
* You want **multiple representations** from the same setup steps (e.g., a single `ReportBuilder` that can produce HTML or PDF).

A good heuristic: if the call site looks ugly with an options object, or if the construction logic involves loops/branches before you have all values, reach for Builder. Otherwise an options object is simpler.

---

### Q2. What's the difference between Builder and Factory?

**Answer:** They solve different problems.

* **Factory** answers *"which class do I instantiate?"* You hand it a key (e.g. `"upi"`) and it picks `UPIProcessor` for you. The construction itself is usually a simple `new`.
* **Builder** answers *"how do I assemble this complex object?"* You already know the class; the challenge is configuring it step by step.

Often they collaborate: a Factory might use a Builder internally, e.g. `ReportFactory.create("invoice")` returns a fully-built `Report` whose construction the factory delegated to a `ReportBuilder`. The factory hides *which* class; the builder hides *how* it gets assembled.

---

### Q3. How does Builder relate to immutability?

**Answer:** Builder is one of the cleanest ways to construct **immutable objects**. The pattern keeps the mutable state quarantined inside the builder and produces an immutable, fully-validated object at the end.

```ts
class Config {
  // public readonly — immutable from outside
  constructor(public readonly host: string, public readonly port: number) {}
}
class ConfigBuilder {
  // mutable fields private to the builder
  private host?: string;
  private port?: number;
  setHost(h: string) { this.host = h; return this; }
  setPort(p: number) { this.port = p; return this; }
  build() {
    if (!this.host || !this.port) throw new Error("incomplete");
    return new Config(this.host, this.port);  // immutable, validated
  }
}
```

Outside code sees only the immutable `Config`. The builder's mutability is implementation detail. This is *exactly* how Java's `record` types are constructed in modern Java, and it's how Rust crates like `reqwest` build `Request` objects.

The pattern also pairs beautifully with persistent data structures (e.g., immutable.js, Immer's `produce`) — a builder collects intent, produces an immutable result.

---

### Q4. Walk me through a Builder for a SQL `SELECT` query.

**Answer:** This is essentially how Knex / Drizzle / Squel are written.

```ts
class SelectQuery {
  constructor(
    readonly columns: string[],
    readonly table: string,
    readonly conditions: string[],
    readonly orderBy?: { column: string; direction: "asc" | "desc" },
    readonly limit?: number,
  ) {}
  toSQL() {
    let sql = `SELECT ${this.columns.join(", ")} FROM ${this.table}`;
    if (this.conditions.length) sql += ` WHERE ${this.conditions.join(" AND ")}`;
    if (this.orderBy) sql += ` ORDER BY ${this.orderBy.column} ${this.orderBy.direction}`;
    if (this.limit !== undefined) sql += ` LIMIT ${this.limit}`;
    return sql;
  }
}

class SelectQueryBuilder {
  private columns: string[] = ["*"];
  private table = "";
  private conditions: string[] = [];
  private orderByClause?: { column: string; direction: "asc" | "desc" };
  private limitN?: number;

  select(...cols: string[]) { this.columns = cols; return this; }
  from(t: string) { this.table = t; return this; }
  where(condition: string) { this.conditions.push(condition); return this; }
  orderBy(column: string, direction: "asc" | "desc" = "asc") {
    this.orderByClause = { column, direction }; return this;
  }
  limit(n: number) { this.limitN = n; return this; }
  build() {
    if (!this.table) throw new Error("from(table) required");
    return new SelectQuery(this.columns, this.table, this.conditions, this.orderByClause, this.limitN);
  }
}

const q = new SelectQueryBuilder()
  .select("id", "name", "email")
  .from("users")
  .where("active = true")
  .where("created_at > '2025-01-01'")
  .orderBy("name", "asc")
  .limit(50)
  .build();

console.log(q.toSQL());
// SELECT id, name, email FROM users WHERE active = true AND created_at > '2025-01-01' ORDER BY name asc LIMIT 50
```

Things the interviewer wants to hear:

1. **Each step returns `this`** for chaining.
2. **State accumulates inside the builder**, not in the final object.
3. **`build()` validates and produces an immutable result** (`SelectQuery` has only `readonly` fields).
4. **Multiple `where()` calls accumulate**, not overwrite — that's a deliberate design choice and you should call it out.
5. **Could extend with `join()`, `groupBy()`, `having()`** without touching the public API of `SelectQuery` for callers — purely additive.

---

### Q5. What are the downsides of the Builder pattern?

**Answer:** Three real costs:

1. **Boilerplate.** A simple class with 3 fields blows up to a class + builder = double the code. Don't use Builder if a constructor is fine.
2. **Two types to maintain.** Adding a new field means adding it to both the class and the builder. Tools and code-gen help, but it's still duplication.
3. **Runtime errors instead of compile-time errors** (in the basic version). If you forget to call `setUrl()`, you don't find out until `build()` throws. The phantom-type version (4b) fixes this but at the cost of significant complexity.

In TS specifically, the case for Builder is weaker than in Java because:

* TS object literals + optional properties already give you named arguments.
* TS's `Partial<T>` and `Required<T>` make options objects expressive.

So the heuristic is: use Builder for **multi-step construction**, **fluent APIs that read as DSLs**, or **complex validation rules that must fire at the end**. For simple "many optional fields" cases, an options object is usually enough.

---

## TL;DR Cheat Sheet

```
Builder: separate the construction of a complex object from its representation.

Reach for Builder when:
  - many optional / interdependent params (telescoping constructor smell)
  - multi-step construction with conditional logic
  - validation must fire once, at the end
  - you want a fluent / DSL-like API

Two flavors:
  - Fluent builder (modern, chained `return this`)
  - Director + Builder (textbook, separates recipes from mechanics)

Pairs well with:
  - Immutable objects (mutable state in builder, readonly on result)
  - Factory (factory uses builder under the hood)

Don't use when:
  - 2-3 fields, mostly required → constructor is fine
  - Simple options object suffices

Real-world: Knex/Drizzle, axios, RxJS pipe, Yup, AWS CDK, test factories
```
