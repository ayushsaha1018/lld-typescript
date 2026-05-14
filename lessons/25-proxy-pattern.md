# 25 — Proxy Pattern

> Phase 4 — Design Patterns → Structural
> Pattern type: Structural
> Difficulty: Easy concept, several useful flavors

---

## 1. Concept / Theory

**Proxy** provides a **placeholder or surrogate** for another object so you can **control access** to it. The proxy implements the *same interface* as the real object — clients can't tell they're talking to a proxy. The proxy intercepts calls and decides whether to forward them, when to forward them, or what to do alongside forwarding.

The defining intent: **control**, not enhancement. A Proxy gates access; it doesn't add new business behavior. (Adding behavior is what Decorator does. We'll cover the difference in detail.)

```
                ┌─────────┐
                │ Client  │
                └────┬────┘
                     │ depends on Subject (interface)
                     ▼
             ┌──────────────┐
             │   Subject    │  (interface)
             └──────┬───────┘
                    △
       ┌────────────┴────────────┐
       │                         │
┌──────────────┐         ┌──────────────┐
│  RealSubject │ ◀───────│    Proxy     │  proxy holds a reference to RealSubject
└──────────────┘         └──────────────┘  and forwards (or doesn't) calls
```

### The four classic flavors

The textbook describes Proxy in four common forms; you'll see all of them in real code.

1. **Virtual Proxy** — lazy initialization. Don't create the expensive RealSubject until someone actually calls a method on it. Image lazy-loading, ORM lazy-loaded relations, expensive object placeholders.
2. **Protection Proxy** — access control. Check permissions/roles before forwarding. Auth middleware, role-based gates.
3. **Remote Proxy** — represents an object that lives on another process or machine. The proxy serializes the call, sends it over the network, and returns the result. Java RMI, gRPC stubs, RPC clients.
4. **Caching Proxy** — store results of expensive operations and return the cached value when possible. CDNs, memoization wrappers, HTTP cache layers.

A fifth flavor sometimes shown: **Smart Reference Proxy** — does reference counting, logging, locking, or other bookkeeping. This blurs into Decorator territory.

### The intent test (critical for interviews)

If the wrapper's job is to *gate or substitute for* the real object, it's a Proxy:

* "Is this user allowed?" → Protection Proxy
* "Has the real object been built yet?" → Virtual Proxy
* "Is the real object on this machine?" → Remote Proxy

If the wrapper's job is to *add behavior* alongside the real call, it's a Decorator:

* "Log this call" / "retry on failure" / "cache this result" — those are *enhancements*; Decorator.

There's overlap (a caching wrapper could be either depending on framing), but the distinction is real and interviewers probe it. Lean on intent: **Proxy controls access; Decorator adds behavior.**

### JavaScript's `Proxy` ≠ the Proxy pattern (but is a great tool to implement it)

JavaScript has a built-in `Proxy` constructor:

```ts
const handler = { get(target, prop) { /* ... */ } };
const p = new Proxy(target, handler);
```

This is a **language feature** — a way to intercept *every* property access, function call, assignment, etc. on an object. It's a meta-programming tool.

The **design pattern** is a higher-level concept that exists in any language. You can implement the Proxy pattern without `new Proxy(...)` — just write a class that implements the same interface and forwards calls. You can also use `new Proxy(...)` for things that aren't really the design pattern (e.g., reactive observables, validation, debugging tools).

In interviews, "Proxy pattern" usually means the design pattern. If they specifically point at `new Proxy(...)` (less common), they want the language feature. Both are worth knowing; we'll show both.

---

## 2. Real-life Analogy

A **debit card** is a proxy for your bank account. When you swipe it at a checkout, the merchant doesn't actually see your account; the card represents it. The card has the same "interface" as cash from the merchant's point of view (it pays for things), but the bank sits behind it doing balance checks, fraud detection, currency conversion, and ledger updates. That's a Protection Proxy + Remote Proxy stacked together.

Other clean analogies:

* **A bouncer at a club** — Protection Proxy. Same "interface" as the club (you walk in), but with an access check first.
* **Power of attorney** — Remote / surrogate proxy. The attorney can act on someone else's behalf.
* **A movie poster outside a theater** — Virtual Proxy. The image stands in for the actual film; you only "load" the film by buying a ticket and going inside.
* **A loading spinner** — also Virtual Proxy. The UI shows a placeholder while the real data is being fetched.

---

## 3. Bad Code Example — Eager Loading + Scattered Auth Checks

Two anti-patterns in one — both fixable by Proxy.

```ts
// ❌ BAD: expensive resource is loaded eagerly, even if never used
class HighResImage {
  private pixels: Uint8Array;
  constructor(public filename: string) {
    console.log(`Loading ${filename} from disk... (50MB, takes 200ms)`);
    this.pixels = new Uint8Array(50_000_000); // simulate heavy load
  }
  display() { console.log(`Displaying ${this.filename}`); }
}

// In a gallery view, we instantiate ALL images up front
class Gallery {
  private images: HighResImage[];
  constructor(filenames: string[]) {
    this.images = filenames.map(f => new HighResImage(f));   // 100 images × 50MB = 5GB!
  }
  showFirst() { this.images[0].display(); }   // we only ever use one
}

// ❌ BAD: auth checks duplicated across every operation
class DocumentService {
  read(userId: string, docId: string) {
    if (!this.canRead(userId, docId)) throw new Error("Forbidden");
    return loadDoc(docId);
  }
  edit(userId: string, docId: string, content: string) {
    if (!this.canEdit(userId, docId)) throw new Error("Forbidden");
    saveDoc(docId, content);
  }
  delete(userId: string, docId: string) {
    if (!this.canDelete(userId, docId)) throw new Error("Forbidden");
    deleteDoc(docId);
  }
  private canRead(u: string, d: string) { /* ... */ return true; }
  private canEdit(u: string, d: string) { /* ... */ return true; }
  private canDelete(u: string, d: string) { /* ... */ return true; }
}
```

What's wrong:

1. **Eager loading wastes resources.** Most images in a gallery are never viewed, but we paid the disk-read cost for all of them.
2. **Auth checks pollute the service layer.** `DocumentService` has both *what to do* and *who's allowed to do it*. Two responsibilities, mixed.
3. **The auth check pattern is repeated** for every method — easy to forget, easy to drift between methods.

Both problems are solved by interposing a Proxy.

---

## 4. Good Code Example — Proxy in TypeScript

### 4a. Virtual Proxy (lazy loading)

```ts
// ============================================================
// Subject — the interface clients depend on
// ============================================================
interface Image {
  display(): void;
  getFilename(): string;
}

// ============================================================
// RealSubject — the expensive object
// ============================================================
class HighResImage implements Image {
  private pixels: Uint8Array;
  constructor(private filename: string) {
    console.log(`Loading ${filename} from disk... (heavy work)`);
    this.pixels = new Uint8Array(50_000_000);
  }
  display() { console.log(`Displaying ${this.filename}`); }
  getFilename() { return this.filename; }
}

// ============================================================
// Proxy — defers construction of the RealSubject until needed
// ============================================================
class LazyImageProxy implements Image {
  private real?: HighResImage;
  constructor(private filename: string) {}

  // Cheap operation — answered without loading
  getFilename() { return this.filename; }

  // Expensive operation — loads on first call
  display() {
    if (!this.real) this.real = new HighResImage(this.filename);
    this.real.display();
  }
}

// ============================================================
// Client
// ============================================================
class Gallery {
  private images: Image[];
  constructor(filenames: string[]) {
    // 100 proxies are cheap — no disk I/O, no 50MB allocation
    this.images = filenames.map(f => new LazyImageProxy(f));
  }
  showFirst()  { this.images[0].display(); }   // only ONE image actually loads
  listNames()  { return this.images.map(i => i.getFilename()); }  // no loading at all
}

const g = new Gallery(["a.jpg", "b.jpg", "c.jpg", /* ... 97 more ... */]);
console.log(g.listNames());   // no images loaded — proxies just hold filenames
g.showFirst();                // only "a.jpg" loads
```

What this buys:

* **Disk I/O is paid only when needed.** 100 cheap proxies vs 100 heavy `HighResImage` objects.
* **Cheap operations stay cheap.** `getFilename()` doesn't trigger a load.
* **Client code is identical.** `Gallery` doesn't know whether it's holding a proxy or a real image.

### 4b. Protection Proxy (access control)

```ts
interface DocumentService {
  read(docId: string): string;
  edit(docId: string, content: string): void;
  delete(docId: string): void;
}

// The real service — clean, no auth concerns
class RealDocumentService implements DocumentService {
  read(docId: string)                   { return `content of ${docId}`; }
  edit(docId: string, content: string)  { /* save */ }
  delete(docId: string)                 { /* delete */ }
}

// The protection proxy — knows about users and permissions
type Permission = "read" | "edit" | "delete";

class AuthDocumentProxy implements DocumentService {
  constructor(
    private real: DocumentService,
    private currentUser: { id: string; roles: string[] },
    private acl: (user: typeof this.currentUser, docId: string, p: Permission) => boolean,
  ) {}

  private require(docId: string, p: Permission) {
    if (!this.acl(this.currentUser, docId, p)) {
      throw new Error(`User ${this.currentUser.id} not allowed to ${p} ${docId}`);
    }
  }

  read(docId: string)                   { this.require(docId, "read");   return this.real.read(docId); }
  edit(docId: string, content: string)  { this.require(docId, "edit");   this.real.edit(docId, content); }
  delete(docId: string)                 { this.require(docId, "delete"); this.real.delete(docId); }
}

// Composition root
const docs: DocumentService = new AuthDocumentProxy(
  new RealDocumentService(),
  { id: "u1", roles: ["editor"] },
  (user, _docId, p) => p !== "delete" || user.roles.includes("admin"),
);

docs.read("doc1");          // ok
docs.edit("doc1", "hi");    // ok
docs.delete("doc1");        // throws — editor can't delete
```

The split:

* **Real service** — pure business logic, no auth.
* **Proxy** — pure access control, no business logic.

Easy to test (mock the proxy or the real service independently). Easy to swap (a different proxy for guests vs admins). Easy to reason about (auth lives in *one* place).

### 4c. Caching Proxy

```ts
interface UserRepo {
  findById(id: string): Promise<User>;
}

class DbUserRepo implements UserRepo {
  async findById(id: string): Promise<User> {
    console.log(`hitting DB for ${id}`);
    return { id, name: `User ${id}` } as User;
  }
}

class CachingUserRepo implements UserRepo {
  private cache = new Map<string, User>();
  constructor(private real: UserRepo, private ttlMs = 30_000) {}

  async findById(id: string): Promise<User> {
    if (this.cache.has(id)) return this.cache.get(id)!;
    const user = await this.real.findById(id);
    this.cache.set(id, user);
    setTimeout(() => this.cache.delete(id), this.ttlMs);
    return user;
  }
}
```

A purist would call this a Decorator (it adds caching behavior). A traditionalist would call it a Caching Proxy (it controls *when* the real subject is invoked). Both are defensible. Reach for whichever framing communicates your intent — interviewers care about the reasoning, not the label.

### 4d. Remote Proxy (RPC stub, conceptually)

```ts
interface Calculator {
  add(a: number, b: number): Promise<number>;
}

// Real implementation lives on a server, somewhere far away.
// Locally, we have a proxy that serializes the call and shoots it over HTTP.
class RemoteCalculatorProxy implements Calculator {
  constructor(private endpoint: string) {}
  async add(a: number, b: number): Promise<number> {
    const res = await fetch(`${this.endpoint}/add`, {
      method: "POST", body: JSON.stringify({ a, b }),
    });
    return res.json().then((r: { result: number }) => r.result);
  }
}

// Client uses Calculator just like a local class
const calc: Calculator = new RemoteCalculatorProxy("https://api.example.com");
const sum = await calc.add(2, 3);
```

This is what gRPC stubs, GraphQL clients, and OpenAPI-generated clients do. The local code looks like calling a local method; under the hood, it's networking.

### 4e. Native JavaScript `Proxy` — the language feature

JS's built-in `Proxy` lets you intercept *every* property access, assignment, function call, etc. without writing forwarding methods one by one.

```ts
function loggingProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      console.log(`get ${String(prop)}`);
      return Reflect.get(obj, prop, receiver);
    },
    set(obj, prop, value, receiver) {
      console.log(`set ${String(prop)} = ${value}`);
      return Reflect.set(obj, prop, value, receiver);
    },
  });
}

const user = loggingProxy({ name: "Ayush", age: 28 });
user.name;            // logs: get name
user.age = 29;        // logs: set age = 29
```

You can use this to implement Proxy-pattern flavors generically — a single utility wraps any object with logging, validation, or access control without needing per-method forwarding code.

Where it really shines: **reactive frameworks**. Vue 3, MobX, and several state libraries use `new Proxy(...)` to intercept reads (to track dependencies) and writes (to trigger re-renders).

```ts
// simplified MobX-style reactivity
function reactive<T extends object>(obj: T): T {
  return new Proxy(obj, {
    set(target, key, value) {
      Reflect.set(target, key, value);
      notifyDependents(target, key);  // imaginary
      return true;
    },
  });
}
```

Mention this in interviews if the topic of native `Proxy` comes up. It shows you understand both the design pattern and the language feature.

---

## 5. Real-world Use Cases

* **HTTP proxy servers** — Cloudflare, Squid, nginx as a reverse proxy. The literal real-world thing the pattern is named after. They sit between client and origin, doing caching, auth, logging, rate-limiting, SSL termination.
* **CDNs** — caching proxies on a global scale.
* **Service workers in browsers** — intercept network requests; can cache, mock, or redirect them. Pure Caching/Smart Reference Proxy.
* **ORM lazy-loaded relations** — Hibernate, TypeORM, Prisma's relations. Accessing `user.orders` triggers a DB query; until then, you have a proxy.
* **Mock objects in testing** — `jest.spyOn()`, `sinon.stub()`. Each replaces a real object with a proxy that records calls and returns canned responses.
* **API gateways** — Kong, AWS API Gateway. Protection + caching + remote-proxying combined.
* **Vue 3 reactivity** — every reactive object is wrapped in a `new Proxy(...)` that tracks dependency reads and triggers updates on writes.
* **MobX, Valtio, Solid stores** — same trick.
* **JWT auth middleware** — every request route is a Protection Proxy: validate token before forwarding to the real handler.
* **Database connection pools** — `client.query()` may be a proxy that picks an idle connection from the pool and forwards. The pool decides *when* and *which* real connection answers.
* **gRPC / GraphQL / REST client SDKs** — generated stubs are Remote Proxies.
* **`Object.freeze` / `Object.seal`** — primitive Protection Proxies built into the language: writes silently fail (in non-strict mode) or throw.
* **Document.querySelector** in older browsers wrapped accessors — a kind of access-control proxy.
* **React Suspense + lazy()** — `React.lazy(() => import('./Comp'))` returns a virtual proxy: a thin component placeholder that triggers loading the real one when first rendered.
* **Image lazy loading on websites** — every modern image library does this. The `<img loading="lazy">` HTML attribute is now native browser support.

---

## 6. Interview Questions

### Q1. Proxy vs Decorator — what's the difference?

**Answer:** Both wrap an object and implement the same interface. The difference is **intent**.

* **Proxy** — controls access. The wrapper's job is to gate, defer, or relocate the call. The wrapper *might not even invoke* the real object (auth denied, cache hit, lazy not-yet-loaded). It manages the lifecycle/availability of the real object.
* **Decorator** — adds behavior. The wrapper *always* forwards to the real object, then adds something around the call (logging, retries, transformation).

Sharper test: if removing the wrapper would cause **incorrect behavior** (unauthorized access, eager loading), it's Proxy. If removing the wrapper would just **lose a feature** (logging, caching, retries), it's Decorator.

There's a gray zone. A "caching wrapper" controls *when* the real object is called → Proxy framing. It also adds *speed* as a feature → Decorator framing. Both are defensible; pick the framing that matches your intent and explain the reasoning.

In practice, both patterns also stack happily: `LoggingDecorator(AuthProxy(CachingProxy(real)))`.

---

### Q2. JavaScript has a `Proxy` constructor. Is that the Proxy pattern?

**Answer:** They're related but distinct.

* The **Proxy design pattern** is a higher-level concept that exists in any OOP language. You write a class that implements the same interface as the real subject and forwards calls under controlled conditions.
* JavaScript's **`new Proxy(target, handler)`** is a *language feature* — a meta-programming primitive that lets you intercept *every* property access, function call, assignment, deletion, etc. on an object via "trap" handlers.

The relationship: JS's `Proxy` is a powerful *implementation tool* for the design pattern. Instead of writing a class that forwards every method by hand, you can wrap any object in a generic proxy. But the language feature is broader — Vue 3's reactive state, MobX's observables, and validation libraries use it for purposes that aren't the GoF Proxy pattern.

Quick demo of the difference:

```ts
// Design pattern, hand-written class
class AuthDocProxy implements DocumentService { /* per-method forwarding */ }

// Language feature, generic interception
const proxy = new Proxy(realDoc, { get(...) { ... } });
```

Both achieve the pattern; the second is mechanical, the first is more verbose but type-safe and explicit.

---

### Q3. Implement a virtual proxy that defers loading an expensive resource.

**Answer:**

```ts
interface Report {
  render(): string;
}

// Expensive: parses 100MB of CSV on construction
class HeavyReport implements Report {
  private data: string;
  constructor(private file: string) {
    console.log(`parsing ${file}... (slow)`);
    this.data = "..."; // imagine 200ms work
  }
  render() { return `Report from ${this.file}: ${this.data.slice(0, 20)}...`; }
}

class LazyReportProxy implements Report {
  private real?: HeavyReport;
  constructor(private file: string) {}

  render() {
    if (!this.real) this.real = new HeavyReport(this.file);
    return this.real.render();
  }
}

// Usage — 1000 proxies are cheap; only the rendered ones pay the cost
const reports = files.map(f => new LazyReportProxy(f));
console.log(reports[5].render()); // only this one loads
```

Things the interviewer wants to hear:

1. **Same interface** as the real subject.
2. **Lazy initialization** in the proxy's method — created on first call, then cached on `this.real` so subsequent calls don't repeat the work.
3. **Thread safety**: in JS we don't worry, but I'd note that in Java you'd need synchronization on the lazy-init.
4. **Proxy is appropriate when most instances aren't used**. If everything gets used eventually, the proxy adds overhead with no win.

A nice extension to mention: **error handling on first load**. If the construction fails, do you set `this.real = undefined` and retry next call, or do you cache the failure? Depends on whether the failure is transient. That nuance is senior-signal.

---

### Q4. Walk me through how `React.lazy` works conceptually.

**Answer:** `React.lazy(() => import('./Foo'))` returns a Virtual Proxy for a component. It's a thin object that React knows how to handle:

1. When React first encounters the lazy component during render, the real component module hasn't been loaded yet. The proxy "throws" a Promise (the import promise).
2. React's Suspense boundary catches this thrown Promise and renders the fallback (e.g., a spinner).
3. When the import resolves, React stores the real component on the lazy wrapper and re-renders.
4. On subsequent renders, the proxy returns the cached real component immediately.

The mental model:

```ts
function lazy(loader: () => Promise<{ default: React.ComponentType }>) {
  let status: "pending" | "resolved" | "rejected" = "pending";
  let result: any;
  let promise = loader().then(
    mod => { status = "resolved"; result = mod.default; },
    err => { status = "rejected"; result = err; },
  );

  return function LazyComponent(props: any) {
    if (status === "pending") throw promise;     // tells Suspense to wait
    if (status === "rejected") throw result;     // tells ErrorBoundary
    return React.createElement(result, props);   // render the real component
  };
}
```

This is essentially Virtual Proxy + Caching Proxy combined: defer until needed, then cache the result.

The interviewer wants to hear that you recognize:

1. The pattern *type* — Virtual Proxy.
2. The role of Suspense — the catch handler that turns the proxy's "not yet" into a UI fallback.
3. The reason this works in React — Suspense is the framework-level mechanism that makes throw-a-promise meaningful.

This is one of the cleanest real-world LLD examples in modern frontend.

---

### Q5. When does a Proxy NOT pay off?

**Answer:** A few situations where reaching for Proxy is wrong or wasteful.

1. **The real object is cheap to construct.** A Virtual Proxy for an object that takes 1ms to build adds complexity for no gain. Proxies pay off when the real subject is genuinely expensive (I/O, allocation, computation) or might never be needed.
2. **You always use the real object.** Lazy loading is pointless if every code path eventually triggers the load. Just construct it.
3. **The proxy is doing real business logic.** If your "Protection Proxy" is making decisions like applying discounts or computing FX rates, that's not access control — it's a service. Proxies should stay thin: gate, defer, relocate, log. No business logic.
4. **Tight inner loops.** A proxy adds an indirection per call. In hot paths (game loops, render loops), that overhead can matter. Profile before adding proxies in performance-critical code.
5. **Errors hide construction failures.** A Virtual Proxy that swallows errors during lazy init can mask bugs. Make sure the proxy propagates failures cleanly.

The honest framing: like most patterns, Proxy adds a layer. The layer pays off when its presence enables a property you couldn't get otherwise (lazy, gated, remote, cached). If none of those apply, just use the real object.

---

## TL;DR Cheat Sheet

```
Proxy: a surrogate that controls access to another object.
       Same interface as the real subject; clients can't tell.

Four classic flavors:
  - Virtual    : lazy initialization (load on first use)
  - Protection : access control / authorization
  - Remote     : represents an object on another machine (RPC stub)
  - Caching    : memoize results of expensive operations

Use when:
  - real object is expensive and may not be used (Virtual)
  - access needs gating that shouldn't pollute business logic (Protection)
  - object lives off-process (Remote)
  - results can be safely cached (Caching)

vs Decorator:
  - Proxy controls access; the real subject may not even be invoked.
  - Decorator adds behavior; the real subject is always invoked.
  - Test: if removing the wrapper breaks correctness → Proxy.
          If removing the wrapper just loses a feature → Decorator.

vs Adapter:
  - Adapter changes the interface (1:1 translation).
  - Proxy preserves the interface (1:1 substitution).

JS Proxy ≠ Proxy pattern:
  - new Proxy(target, handler) is a language feature for intercepting
    all property/operation access — used by Vue 3, MobX, Valtio, etc.
  - The Proxy design pattern is a higher-level concept; JS Proxy is
    one tool to implement it.

Real-world: HTTP proxies, CDNs, service workers, ORM lazy-loaded
            relations, mock objects, JWT auth middleware, Vue 3
            reactivity, React.lazy + Suspense, gRPC stubs.
```
