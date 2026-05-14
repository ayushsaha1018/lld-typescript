# 16 — Singleton Pattern

> Phase 4 — Design Patterns → Creational
> Pattern type: Creational
> Difficulty: Easy to write, easy to misuse

---

## 1. Concept / Theory

**Singleton** ensures a class has **exactly one instance** and provides a **global access point** to it.

You enforce three things:

1. The constructor is **private** — outside code can't call `new MyClass()`.
2. The class holds a **static reference** to its single instance.
3. A **static method** (`getInstance()`) returns that instance, creating it on first call (lazy) or at class-load time (eager).

That's the mechanical recipe. The *interesting* part of Singleton — and what interviewers actually probe — is **when to use it and when NOT to**.

### When Singleton is justified

* The object **truly must be unique** in the process — e.g. a config registry, a logger, a connection pool, a cache.
* Multiple instances would be **wrong**, not just wasteful (e.g. two loggers writing to the same file would cause interleaved output and locking issues).

### When Singleton is a smell

* You're using it as a *convenient global variable*. ("It's easier to call `Service.getInstance()` than to pass it around.")
* Several Singletons start depending on each other → hidden coupling.
* Tests become painful — you can't reset state between tests because the instance is global.

The honest framing for interviews: "Singleton is a useful tool for shared resources, but it's also one of the most overused patterns. I prefer dependency injection in most cases; I'd reach for Singleton only when uniqueness is a real invariant of the system."

That sentence alone makes you sound senior.

### Lazy vs Eager initialization

* **Eager** — instance is created when the class loads. Simple, no race conditions, but you pay the cost even if you never use it.
* **Lazy** — instance is created on first `getInstance()` call. Saves resources, but in multi-threaded languages (Java/C#) you must guard the creation. In single-threaded JS/TS you don't have this problem — which is one of the reasons Singletons in TS are simpler than in Java.

### A note on JavaScript / TypeScript

In JS, **every ES module is already a singleton**. If you `export const logger = new Logger()`, every file that imports it gets the same object. That's often the cleanest "Singleton" you'll write in TS. We'll see both forms below — the textbook class-based one (because that's what interviewers expect) and the idiomatic module-based one.

---

## 2. Real-life Analogy

The **President of a country**. The role is defined such that only one person holds it at any time. There's no `new President("Alice")` — instead you call `Country.getCurrentPresident()`. Everyone gets the same reference. If you somehow instantiated a second president, the system would be in an inconsistent state.

Other good analogies: the **printer spooler** in an OS (one queue serving all jobs), or the **central bank** (every commercial bank routes through the *same* one).

---

## 3. Bad Code Example — Naive "Just New It Up" + Module-Level Globals

```ts
// ❌ BAD: Logger created freely wherever it's needed
class Logger {
  log(msg: string) {
    // Imagine this opens a file handle, holds a buffer, etc.
    console.log(`[${new Date().toISOString()}] ${msg}`);
  }
}

class OrderService {
  private logger = new Logger();   // own logger
  placeOrder() { this.logger.log("order placed"); }
}

class PaymentService {
  private logger = new Logger();   // ANOTHER logger
  pay()        { this.logger.log("payment done"); }
}

class InventoryService {
  private logger = new Logger();   // YET ANOTHER
  reserve()    { this.logger.log("inventory reserved"); }
}
```

What's wrong:

1. **Wasted resources** — three Logger objects, three open file handles, three buffers.
2. **Inconsistent config** — if you later add log levels, every service must be updated separately.
3. **No coordination** — log lines from different loggers can interleave and corrupt the output file.
4. **Hard to swap** — you can't easily switch to a different logger backend across the app.

A junior dev's "fix" is often to make a global variable:

```ts
// ❌ Slightly less bad but still ugly
export const globalLogger = new Logger(); // implicit module-level singleton, but unstructured
```

This works in JS, but it leaks an implementation detail (the `new Logger()` call) and you can never enforce that someone won't `new Logger()` themselves. We can do better.

---

## 4. Good Code Example — Singleton in TypeScript

### 4a. Classic Singleton (lazy, class-based)

This is what interviewers expect when they say "implement Singleton."

```ts
class Logger {
  private static instance: Logger | null = null;
  private logCount = 0;

  // private constructor → no one outside can `new Logger()`
  private constructor(private readonly level: "debug" | "info" | "error") {}

  // single global access point
  static getInstance(): Logger {
    if (Logger.instance === null) {
      Logger.instance = new Logger("info");
    }
    return Logger.instance;
  }

  log(msg: string) {
    this.logCount++;
    console.log(`[${this.level}] (${this.logCount}) ${msg}`);
  }
}

// usage
const a = Logger.getInstance();
const b = Logger.getInstance();
console.log(a === b);  // true — same instance

a.log("user signed in");
b.log("order placed");
// → [info] (1) user signed in
// → [info] (2) order placed   ← shared logCount proves it's the same object
```

Key points to call out in the interview:

* `private constructor` — prevents `new Logger()` from outside.
* `static instance: Logger | null` — holds the single instance.
* `getInstance()` — lazy init pattern.
* Returns the *same reference* every call.

### 4b. Singleton with parameters (the trick question)

What if the singleton needs config? You can't pass it every time — it would only matter on the first call:

```ts
class ConfigManager {
  private static instance: ConfigManager;
  private constructor(private readonly env: string) {}

  static init(env: string) {
    if (this.instance) {
      throw new Error("ConfigManager already initialized");
    }
    this.instance = new ConfigManager(env);
  }

  static getInstance(): ConfigManager {
    if (!this.instance) throw new Error("ConfigManager not initialized — call init() first");
    return this.instance;
  }

  get(key: string) { /* ... */ }
}

// app bootstrap
ConfigManager.init(process.env.NODE_ENV ?? "dev");

// later, anywhere
ConfigManager.getInstance().get("DB_URL");
```

This is a "two-phase singleton" — `init()` once at the top of `main`, then `getInstance()` everywhere. This is how Sentry, Firebase, Stripe SDK initialize.

### 4c. The idiomatic TS way — module singleton

```ts
// logger.ts
class Logger {
  private logCount = 0;
  log(msg: string) {
    this.logCount++;
    console.log(`[info] (${this.logCount}) ${msg}`);
  }
}
export const logger = new Logger();   // exported instance, not the class

// orderService.ts
import { logger } from "./logger";
logger.log("order placed");

// paymentService.ts
import { logger } from "./logger";
logger.log("payment done");      // same logCount counter as above
```

ES modules are cached by the runtime — every import returns the same object. This is what most production TS codebases actually do for things like `db`, `redis`, `logger`. **In an interview, mention this as the idiomatic JS/TS approach** after you write the textbook version.

### 4d. The testing escape hatch

The number one criticism of Singleton is "untestable global state." Be ready with this:

```ts
class Logger {
  private static instance: Logger | null = null;
  private constructor(private readonly level: string) {}

  static getInstance(): Logger {
    if (!Logger.instance) Logger.instance = new Logger("info");
    return Logger.instance;
  }

  // for tests only
  static _resetForTests() {
    Logger.instance = null;
  }
}
```

In real code, prefer **constructor injection** so each class receives its dependencies — that sidesteps the testing issue entirely.

---

## 5. Real-world Use Cases

* **Logger** — Winston, Pino, Bunyan: typically a single configured logger imported across the app.
* **Database connection pool** — `pg.Pool`, Mongoose connection: one pool managing N underlying connections, but you only ever want one pool.
* **Redux / Zustand stores** — there's exactly one store per app; components subscribe to it.
* **Browser APIs** — `window`, `document`, `navigator` are all singletons enforced by the browser.
* **OS-level** — the print spooler, the file system metadata cache, the kernel scheduler.
* **Stripe / Firebase / Sentry SDKs** — initialized once at boot (`init()`), then accessed from anywhere.
* **Config manager** — environment variables, feature flags, secrets resolved once and shared.
* **Cache layer** — an in-memory LRU cache shared by all request handlers.

In React/Next.js apps you'll often see this pattern for the API client:

```ts
// api.ts
import axios from "axios";
export const api = axios.create({ baseURL: process.env.API_URL });
```

That's a Singleton, dressed in module syntax.

---

## 6. Interview Questions

### Q1. Implement a thread-safe Singleton in TypeScript.

**Answer:** First, I'd clarify — JavaScript runs on a single-threaded event loop, so true thread-safety isn't a concern in the way it is for Java or C#. There are no concurrent calls to `getInstance()` happening at the same instant, so the simple lazy implementation is already safe.

```ts
class Singleton {
  private static instance: Singleton | null = null;
  private constructor() {}
  static getInstance(): Singleton {
    if (!Singleton.instance) Singleton.instance = new Singleton();
    return Singleton.instance;
  }
}
```

If the interviewer is asking the Java-style question (double-checked locking, `volatile`), I'd explain that pattern conceptually but note it's a Java idiom. The TS equivalent in a Node.js worker-threads scenario would be either (a) keep the singleton per-thread, since each worker has its own V8 isolate, or (b) move shared state out of the process entirely (Redis, DB).

That answer shows you actually understand the runtime, not just the pattern.

---

### Q2. What's the difference between a Singleton and a class with all static methods?

**Answer:** Both give you a single shared "thing," but they differ in important ways:

* **A static class** is a namespace of functions. It cannot implement an interface, cannot be passed as a parameter (you can't pass `MyStaticClass` somewhere expecting `IService`), and cannot be subclassed meaningfully. It also can't hold instance state — only static fields.
* **A Singleton** is a real object. It can implement interfaces, be passed around as a parameter, be replaced with a mock in tests, and participate in polymorphism.

So if you ever think you might want to (a) swap implementations (real DB vs. fake DB), (b) inject the dependency, or (c) treat it polymorphically — use a Singleton, not a static class.

Static classes are fine for pure utility functions (`Math.max`, `JSON.parse`). For anything that has state or might be substituted, use Singleton.

---

### Q3. Why do many senior engineers consider Singleton an anti-pattern?

**Answer:** Three big reasons:

1. **It hides dependencies.** A class that calls `Logger.getInstance()` doesn't declare that it depends on Logger anywhere in its public API. You only learn this by reading the implementation. Constructor-injected dependencies are explicit and visible.
2. **It makes testing painful.** Singletons hold state across tests. You either need a `_resetForTests()` escape hatch (ugly) or you accept flaky tests (worse).
3. **It encourages hidden coupling.** Once `Logger.getInstance()` is callable from anywhere, every layer of the codebase quietly depends on Logger. Replacing it later is a refactor across the entire codebase.

The senior take: prefer **dependency injection**. Inject a single instance from the composition root (`main`/bootstrap file) into the things that need it. That gives you the benefits of singleton (one shared instance) without the global access point.

Use real Singleton only when (a) the global access truly is needed (logger called from deep utility code where threading a parameter through is impractical), or (b) the language/framework gives you no DI mechanism.

---

### Q4. How do you break a Singleton? How do you defend against that?

**Answer:** A few classic ways the singleton invariant can be violated:

1. **Reflection** (Java) — `setAccessible(true)` on the constructor and call it. TS/JS don't have this exact attack, but `Reflect.construct` could be used if metadata leaked. Defense: throw inside the constructor if `instance` is already set.
2. **Serialization / deserialization** — serializing the singleton and deserializing it produces a fresh object. Defense: implement custom (de)serialization that returns the existing instance, or just don't serialize singletons.
3. **Multiple class loaders** (Java) or **multiple Node module instances** (e.g. monorepos with duplicate copies of a dependency) — each loader has its own static field. Defense: deduplicate dependencies in the build, or store the instance on a process-global like `globalThis`.
4. **Cloning** — calling `Object.assign({}, singleton)` or `structuredClone()` produces a copy. Defense: the singleton's *identity* is what matters; if someone clones it, that's their broken object, not the real singleton.

Defensive constructor:

```ts
private constructor() {
  if (Logger.instance) throw new Error("Use Logger.getInstance()");
}
```

---

### Q5. You're designing a payment system. Should the `PaymentService` be a Singleton? Walk me through your reasoning.

**Answer:** Probably not — and here's why.

A `PaymentService` is a stateless façade that orchestrates calls to payment gateways. There's no resource it owns that *must* be unique:

* The HTTP client to Stripe? That can be its own singleton injected in.
* The DB connection? Already a singleton (the pool).
* The logger? Already a singleton.

So `PaymentService` itself can be created freely — and *should* be, because making it a Singleton means you lose the ability to test it with different gateway/logger/db combinations.

What I'd actually do:

```ts
const paymentService = new PaymentService(stripeGateway, db, logger);
// register in DI container, use the same instance everywhere by convention
```

One instance in production, but not enforced by a Singleton class — enforced by the composition root. In tests, I create new ones with mocks freely.

Singletons should be reserved for things that *cannot* sensibly be duplicated: connection pools, configuration, the logger itself, in-memory caches. Service classes are not in that bucket.

---

## TL;DR Cheat Sheet

```
Singleton recipe:
  1. private constructor
  2. private static instance: T | null = null
  3. public static getInstance(): T

Lazy:    instance created on first getInstance() call
Eager:   instance = new T()  declared at class load
TS-idiomatic: `export const x = new T()` — module is the singleton

Use when: shared resource truly must be unique (logger, pool, config)
Avoid when: it's just convenient global state — use DI instead

Interview red flag: "I'd make every service a Singleton."
Interview green flag: "Singleton is fine for the logger; for services I'd inject."
```
