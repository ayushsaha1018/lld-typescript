# 22 — Decorator Pattern

> Phase 4 — Design Patterns → Structural
> Pattern type: Structural
> Difficulty: Easy concept, very practical, interview gold

---

## 1. Concept / Theory

**Decorator** wraps an object with another object that adds behavior, while keeping the **same interface**. The wrapper exposes everything the wrapped object exposes — plus something extra.

The defining property: decorators are **stackable**. You can wrap a wrapped object, infinitely. Each layer is independent, each adds one capability.

```
                 implements        delegates
   Decorator2 ──────────────▶ ◇ ─────────────▶ Decorator1 ──▶ ◇ ──▶ Component
       │                                            │                     ▲
       │     Both Decorator1 and Decorator2         │                     │
       │     implement the SAME interface as the    │                     │
       │     Component. From the outside, you       │                     │
       │     can't tell whether you're holding      │                     │
       │     a Component, a Decorator1, or a        │                     │
       │     Decorator2 stack.                      │                     │
       └────────────────────────────────────────────┴─────────────────────┘
```

The killer use case: **adding orthogonal cross-cutting concerns** — logging, caching, retries, auth, rate limiting, metrics, validation — without modifying the original class.

### Why it beats inheritance

The textbook anti-pattern is the **subclass explosion**: every combination of features becomes its own class.

* `Coffee`
* `CoffeeWithMilk`
* `CoffeeWithSugar`
* `CoffeeWithMilkAndSugar`
* `CoffeeWithCinnamon`
* `CoffeeWithMilkAndCinnamon`
* `CoffeeWithSugarAndCinnamon`
* `CoffeeWithMilkAndSugarAndCinnamon`
* ...

For N orthogonal features, you need 2^N subclasses. Decorator turns that into N small classes that compose: `new Cinnamon(new Sugar(new Milk(new Coffee())))`. Combinatorial explosion gone.

This is one of the cleanest demonstrations of *"favor composition over inheritance"* — the principle from your earlier lesson — in pattern form.

### Ordering matters

The order in which you stack decorators is **observable**. A `Cache` outside a `Retry` is different from a `Retry` outside a `Cache`. We'll cover this in detail because interviewers ask it.

### TypeScript `@decorator` syntax vs the design pattern

These are related but distinct.

* The **design pattern** (this lesson) is a runtime composition technique that exists in any language. You wrap an object with another object.
* The **TS `@decorator` syntax** (`@Injectable`, `@Get('/users')`, `@Component(...)`) is a *language feature* for attaching metadata or modifying class definitions at declaration time. Frameworks like NestJS, Angular, and TypeORM lean on it heavily.

The two are conceptually related — both are about "wrapping" — but they operate at different layers. You can implement the Decorator design pattern *without* using `@decorator` syntax (and most production code does). You can also use `@decorator` syntax for things that aren't really the Decorator pattern (e.g., dependency injection markers like `@Injectable`).

When an interviewer asks about Decorator, they almost certainly mean **the design pattern**, not the TS syntax. If they ask specifically about `@`, mention both.

---

## 2. Real-life Analogy

**Layered clothing.** You have a base layer (T-shirt). It's cold, so you add a sweater. Going outside, you add a jacket. Raining, so a raincoat goes on top. Each layer is independent, each adds one property (warmth, wind-resistance, water-resistance). You can mix and match — sweater + raincoat without the jacket — and the order can matter (you'd put the T-shirt closest to skin, raincoat outermost).

The classic textbook analogy is **coffee with toppings**. Plain espresso → add milk → add sugar → add foam → add cinnamon. The drink's "interface" (a beverage you can `cost()` and `describe()`) doesn't change as you stack toppings. The `cost()` returns the sum of every layer.

A more modern analogy: **photo filters in Instagram**. Apply a sepia filter, then a vignette, then a noise filter. Each filter is a decorator over the previous image; the output is the same kind of image, just with extra processing.

---

## 3. Bad Code Example — Subclass Explosion

Here's what a coffee shop modeled with inheritance looks like as features grow.

```ts
// ❌ BAD: every combination is its own class
class Coffee {
  cost() { return 5; }
  describe() { return "Coffee"; }
}

class CoffeeWithMilk extends Coffee {
  cost() { return super.cost() + 1; }
  describe() { return super.describe() + ", milk"; }
}

class CoffeeWithSugar extends Coffee {
  cost() { return super.cost() + 0.5; }
  describe() { return super.describe() + ", sugar"; }
}

class CoffeeWithMilkAndSugar extends CoffeeWithMilk {
  cost() { return super.cost() + 0.5; }
  describe() { return super.describe() + ", sugar"; }
}

class CoffeeWithCinnamon extends Coffee {
  cost() { return super.cost() + 0.75; }
  describe() { return super.describe() + ", cinnamon"; }
}

class CoffeeWithMilkAndCinnamon extends CoffeeWithMilk {
  cost() { return super.cost() + 0.75; }
  describe() { return super.describe() + ", cinnamon"; }
}

class CoffeeWithMilkSugarAndCinnamon extends CoffeeWithMilkAndSugar {
  cost() { return super.cost() + 0.75; }
  describe() { return super.describe() + ", cinnamon"; }
}
// ... and so on for every combination, exponentially.
```

What's wrong:

1. **2^N classes.** With 5 add-ons, that's 32 combinations. Add hazelnut and you double everything.
2. **Logic duplication.** "Cinnamon adds 0.75" is written in three different places.
3. **Frozen at compile time.** "Two shots of espresso" or "Half-decaf, half-regular" require yet more classes.
4. **Order is structural, not data.** You can't say "milk first, then sugar" — that's two different classes.
5. **Fragile.** Editing the price of milk means hunting through six classes.

The instinct to fix this with multiple inheritance ("CoffeeWithMilkAndSugar extends CoffeeWithMilk, CoffeeWithSugar") doesn't work in TS, and even where it does (C++) it produces the diamond problem. Decorator is the right answer.

---

## 4. Good Code Example — Decorator in TypeScript

### 4a. The textbook example — Coffee + toppings

```ts
// ============================================================
// 1) Component interface — what every Beverage exposes
// ============================================================
interface Beverage {
  cost(): number;
  describe(): string;
}

// ============================================================
// 2) Concrete components — base products
// ============================================================
class Espresso implements Beverage {
  cost()     { return 5; }
  describe() { return "Espresso"; }
}

class HouseBlend implements Beverage {
  cost()     { return 4; }
  describe() { return "House Blend"; }
}

// ============================================================
// 3) Base decorator — wraps any Beverage, IS a Beverage
// ============================================================
abstract class BeverageDecorator implements Beverage {
  constructor(protected wrapped: Beverage) {}
  abstract cost(): number;
  abstract describe(): string;
}

// ============================================================
// 4) Concrete decorators — each adds one feature
// ============================================================
class Milk extends BeverageDecorator {
  cost()     { return this.wrapped.cost() + 1; }
  describe() { return this.wrapped.describe() + ", milk"; }
}

class Sugar extends BeverageDecorator {
  cost()     { return this.wrapped.cost() + 0.5; }
  describe() { return this.wrapped.describe() + ", sugar"; }
}

class Cinnamon extends BeverageDecorator {
  cost()     { return this.wrapped.cost() + 0.75; }
  describe() { return this.wrapped.describe() + ", cinnamon"; }
}

class ExtraShot extends BeverageDecorator {
  cost()     { return this.wrapped.cost() + 1.5; }
  describe() { return this.wrapped.describe() + ", extra shot"; }
}

// ============================================================
// 5) Compose at runtime
// ============================================================
let drink: Beverage = new Espresso();
drink = new ExtraShot(drink);
drink = new Milk(drink);
drink = new Sugar(drink);
drink = new Cinnamon(drink);

console.log(drink.describe());  // "Espresso, extra shot, milk, sugar, cinnamon"
console.log(drink.cost());      // 5 + 1.5 + 1 + 0.5 + 0.75 = 8.75

// Different combination — no new classes needed
let drink2: Beverage = new Cinnamon(new Milk(new HouseBlend()));
console.log(drink2.describe()); // "House Blend, milk, cinnamon"
```

What changed from the bad version:

* **Five small classes** (Espresso, HouseBlend, Milk, Sugar, Cinnamon) replace 2^N combinations.
* **Combinations are runtime data**, not compile-time hierarchy.
* **Each "add-on" cost lives in exactly one place.**
* **Easy to add features**: ExtraShot was added in two minutes.

### 4b. Real-world example — HTTP client with cross-cutting concerns

This is what production wrappers around `fetch`/`axios` look like. Each concern is a separate decorator.

```ts
// ============================================================
// Component interface
// ============================================================
interface HttpClient {
  get(url: string): Promise<unknown>;
}

// ============================================================
// Base implementation
// ============================================================
class FetchClient implements HttpClient {
  async get(url: string): Promise<unknown> {
    const res = await fetch(url);
    return res.json();
  }
}

// ============================================================
// Decorator: logging
// ============================================================
class LoggingClient implements HttpClient {
  constructor(private wrapped: HttpClient, private logger = console) {}
  async get(url: string): Promise<unknown> {
    const t0 = Date.now();
    this.logger.log(`→ GET ${url}`);
    try {
      const result = await this.wrapped.get(url);
      this.logger.log(`← GET ${url} ok in ${Date.now() - t0}ms`);
      return result;
    } catch (e) {
      this.logger.error(`× GET ${url} failed:`, e);
      throw e;
    }
  }
}

// ============================================================
// Decorator: caching
// ============================================================
class CachingClient implements HttpClient {
  private cache = new Map<string, unknown>();
  constructor(private wrapped: HttpClient, private ttlMs = 60_000) {}
  async get(url: string): Promise<unknown> {
    if (this.cache.has(url)) return this.cache.get(url);
    const result = await this.wrapped.get(url);
    this.cache.set(url, result);
    setTimeout(() => this.cache.delete(url), this.ttlMs);
    return result;
  }
}

// ============================================================
// Decorator: retries with exponential backoff
// ============================================================
class RetryingClient implements HttpClient {
  constructor(private wrapped: HttpClient, private maxAttempts = 3) {}
  async get(url: string): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.wrapped.get(url);
      } catch (e) {
        lastErr = e;
        if (attempt < this.maxAttempts) {
          await new Promise(r => setTimeout(r, 2 ** attempt * 100));
        }
      }
    }
    throw lastErr;
  }
}

// ============================================================
// Decorator: auth header injection
// ============================================================
class AuthClient implements HttpClient {
  constructor(private wrapped: HttpClient, private token: string) {}
  async get(url: string): Promise<unknown> {
    // (in a real version we'd thread headers through; simplified for the lesson)
    const urlWithAuth = `${url}${url.includes("?") ? "&" : "?"}token=${this.token}`;
    return this.wrapped.get(urlWithAuth);
  }
}

// ============================================================
// Compose at the boundary
// ============================================================
const client: HttpClient =
  new LoggingClient(
    new CachingClient(
      new RetryingClient(
        new AuthClient(
          new FetchClient(),
          process.env.API_TOKEN!,
        ),
        3,
      ),
      60_000,
    ),
  );

await client.get("https://api.example.com/users");
```

Reading the layers from outside-in: every request gets logged, then we hit the cache (which short-circuits everything below it), if it's a miss we apply retries, each retry adds the auth token, and finally we call `fetch`.

If you wanted a *different* behavior for a particular endpoint (say, no caching for `/livestream`), you compose a different stack — same components, different order.

### 4c. Order of decoration is observable

The order matters because each decorator's responsibilities interact with the others.

```ts
// Cache OUTSIDE Retry:
//   - on cache hit: zero retries, zero requests. fastest path.
//   - on cache miss: one retry stack runs, result cached.
//   - effect: cached requests are quick; failures don't poison the cache.
new CachingClient(new RetryingClient(new FetchClient()))

// Retry OUTSIDE Cache:
//   - cache miss → fetch → if it fails, RETRY which checks cache again (still empty),
//     fetches again, etc.
//   - effect: each retry attempts the cache lookup (wasted work) AND
//     a partial-success scenario could cache a stale value.
//   - usually wrong ordering for HTTP fetches.
new RetryingClient(new CachingClient(new FetchClient()))
```

Or for logging vs auth:

```ts
// Logging OUTSIDE Auth: the log line shows the URL WITH the token. Bad — secrets in logs.
new LoggingClient(new AuthClient(new FetchClient(), token))

// Logging INSIDE Auth: log line shows raw URL, auth happens after. Good.
new AuthClient(new LoggingClient(new FetchClient()), token)
```

This is an interview gold-star: identifying that decorator order has correctness and security implications.

### 4d. Function-style decorators

In TS, when the interface has just one method, a "decorator" is often just a higher-order function. Same pattern, less ceremony.

```ts
type Fetcher = (url: string) => Promise<unknown>;

const withLogging = (next: Fetcher): Fetcher => async (url) => {
  console.log(`→ ${url}`);
  const result = await next(url);
  console.log(`← ${url}`);
  return result;
};

const withRetry = (next: Fetcher, max = 3): Fetcher => async (url) => {
  for (let i = 1; i <= max; i++) {
    try { return await next(url); } catch (e) { if (i === max) throw e; }
  }
};

const baseFetch: Fetcher = async (url) => (await fetch(url)).json();
const fetcher = withLogging(withRetry(baseFetch));

await fetcher("https://api.example.com/users");
```

This is essentially how Express and Koa middleware work, and it's the most common decorator-pattern shape in idiomatic JS/TS.

---

## 5. Real-world Use Cases

* **Express / Koa / Fastify middleware** — `app.use(logger).use(auth).use(cors)`. Pure Decorator pattern in function form.
* **React Higher-Order Components (HOCs)** — `withRouter(withAuth(withTheme(MyPage)))`. Each HOC wraps the component with an extra concern. Modern React favors hooks, but HOCs still appear in libraries.
* **Redux middleware** — `applyMiddleware(thunk, logger, sagas)` is decoration over `dispatch`.
* **RxJS operators** — `observable.pipe(map(...), filter(...), retry(3), debounceTime(300))`. Each operator wraps the source observable.
* **Java I/O streams** (the textbook example) — `new BufferedReader(new InputStreamReader(new FileInputStream(file)))`. Three decorators stack to give buffered, character-decoded, file-backed reading.
* **NestJS guards, interceptors, pipes** — built on top of TS `@decorator` syntax but the underlying pattern is Decorator.
* **GraphQL field resolvers with directives** — `@auth`, `@deprecated`, `@cacheControl` add cross-cutting behavior.
* **AWS Lambda middleware (Middy)** — `middy(handler).use(httpJsonBodyParser()).use(httpErrorHandler())`. Same pattern.
* **Logging frameworks** — wrapping a logger with formatters, samplers, async-buffering layers.
* **Resilience libraries** — `polly` (.NET), `resilience4j` (Java), or hand-rolled retry/circuit-breaker/timeout wrappers in any language.
* **Image processing pipelines** — sharp, ImageMagick: each transformation wraps the previous result.
* **Encryption / compression layers** — `gzip(encrypt(payload))` vs `encrypt(gzip(payload))` — different security properties, same shape pattern.

---

## 6. Interview Questions

### Q1. What's the difference between Decorator, Adapter, and Proxy?

**Answer:** All three are structural patterns where one class wraps another, but their *intent* differs.

* **Adapter** — same behavior, *different interface*. Translates between an existing API and the one your code expects.
* **Decorator** — *same interface*, *added behavior*. Stackable layers of cross-cutting concerns (logging, caching, retry, auth).
* **Proxy** — same interface, *controlled access*. Intercepts calls to gate them: lazy loading, access control, remote calls, smart references. The Proxy's intent is *control*, not *enhancement*.

A useful test: if the wrapper is adding "extra stuff every caller wants," it's a Decorator. If it's gatekeeping or substituting for the real thing, it's a Proxy. If it's bridging incompatible APIs, it's an Adapter.

You can stack them: `LoggingDecorator(CachingDecorator(AuthProxy(StripeAdapter(stripeSdk))))`.

---

### Q2. Why use Decorator instead of inheritance?

**Answer:** Three big reasons:

1. **Avoids subclass explosion.** With N orthogonal features, inheritance produces 2^N classes for every combination. Decorator gives you N classes that compose at runtime.
2. **Combinations are data, not classes.** You can read the user's preferences and build exactly the right stack at runtime — `extras.includes("milk") && stack = new Milk(stack)`. Inheritance can't do that.
3. **Open/Closed Principle.** Adding a new feature is a new decorator class; no existing class is modified. Inheritance often forces edits to base classes.

Inheritance is still appropriate when there's a real "is-a" relationship and the variation is in *kind*, not in *features*. Use inheritance for `Dog extends Animal`. Use Decorator for `Cached(Logged(Retrying(client)))`.

---

### Q3. The TypeScript language has `@decorator` syntax. Is that the Decorator pattern?

**Answer:** Related, but not identical.

The TS `@decorator` syntax is a *language feature* that lets you attach metadata or transform class declarations at *declaration time*:

```ts
@Injectable()
class UserService {
  @Get("/users")
  list() { ... }
}
```

Frameworks like NestJS and Angular use this for dependency injection, route registration, and similar metadata-driven behavior. Under the hood it's a function that runs at class-definition time and can modify the class.

The **design pattern** Decorator is *runtime composition* — wrapping an instance with another instance that has the same interface. You don't need any special syntax; in fact, most production decorator-pattern code uses plain class composition or higher-order functions.

The two can overlap: you *can* implement a logging decorator using `@log` syntax to wrap method calls. But TS's `@decorator` syntax is also used for things that aren't really the Decorator pattern (`@Component`, `@Injectable`).

So in interviews: when someone says "Decorator pattern," they almost always mean the runtime-composition GoF pattern. The `@` syntax is named after it but isn't synonymous with it.

---

### Q4. Implement a `LoggingDecorator` for a `UserService`. Walk me through it.

**Answer:**

```ts
interface UserService {
  getUser(id: string): Promise<User>;
  createUser(name: string, email: string): Promise<User>;
}

class RealUserService implements UserService {
  async getUser(id: string)               { /* db lookup */ return { id, name: "..." } as User; }
  async createUser(name: string, e: string) { /* db insert */ return { id: "1", name } as User; }
}

class LoggingUserService implements UserService {
  constructor(private wrapped: UserService, private logger = console) {}

  async getUser(id: string): Promise<User> {
    const t0 = Date.now();
    this.logger.log(`getUser(${id}) start`);
    try {
      const u = await this.wrapped.getUser(id);
      this.logger.log(`getUser(${id}) ok in ${Date.now() - t0}ms`);
      return u;
    } catch (e) {
      this.logger.error(`getUser(${id}) failed:`, e);
      throw e;
    }
  }

  async createUser(name: string, email: string): Promise<User> {
    const t0 = Date.now();
    this.logger.log(`createUser(${name}, ${email}) start`);
    try {
      const u = await this.wrapped.createUser(name, email);
      this.logger.log(`createUser ok id=${u.id} in ${Date.now() - t0}ms`);
      return u;
    } catch (e) {
      this.logger.error(`createUser failed:`, e);
      throw e;
    }
  }
}

const userService: UserService = new LoggingUserService(new RealUserService());
```

What the interviewer is checking:

1. **Same interface** — `LoggingUserService implements UserService`. The caller can swap them transparently.
2. **Composition, not inheritance.** We hold a `wrapped: UserService` reference. Could be the real one, a mock, or another decorator.
3. **Logging is around the call.** Start time and end time logs bracket the inner call; errors are logged before re-throwing.
4. **Doesn't change behavior.** `LoggingUserService` returns whatever the wrapped service returned — it's a transparent layer.

Follow-up they'll probably ask: "What's the downside of writing one `Logging*Service` class per service?" The answer is **boilerplate** — for many methods you write the same try/catch/timing pattern. Mitigations: a generic `Proxy`-based wrapper that intercepts every method, or a higher-order function that logs around any method, or use `Proxy` (the JS built-in) to handle it dynamically. Mention these as options if asked.

---

### Q5. Why does the order of decorators matter? Give a concrete example.

**Answer:** Because each decorator's behavior is "around" the call to the next one. Swapping the order changes when each effect fires.

Concrete examples:

**Caching outside Retry** — `new Cache(new Retry(client))`:
* On cache hit, no network call, no retry attempts. Fastest.
* On cache miss, the inner Retry stack runs once and the result is cached. Failures aren't cached (the throw propagates past Cache).

**Retry outside Caching** — `new Retry(new Cache(client))`:
* On cache miss, `Retry` calls `Cache.get()`, which is a miss, which calls the network. If it fails, Retry runs again, which calls Cache.get again — but the cache is still empty, so it hits the network again. Same as the previous version, but with extra wasted Cache lookups.
* Worse: if your Cache is shared, a transient failure followed by a partial response could be cached and stale.

**Logging outside Auth** — `new Logging(new Auth(client))`:
* Log lines include the URL *with the auth token appended* (since Auth wraps inside, the Logging layer sees the original URL... actually depends on which side adds the token; if Auth modifies the URL before calling next, then Logging at the outer level sees the *unmodified* one). The reverse — `new Auth(new Logging(client))` — would log the URL after the auth token was inserted, leaking secrets.

**Validation inside Authorization** — `new Authorize(new Validate(handler))`:
* Validation runs after authorization. So unauthenticated callers don't waste cycles getting their input validated. Better for both performance and security.

The general rule: think about each decorator as "happens before/after the inner call." Then ask: which order satisfies my correctness, performance, and security constraints?

---

## TL;DR Cheat Sheet

```
Decorator: wrap an object with another object that has the SAME interface
           and adds behavior. Stackable.

Recipe:
  1. Component interface (what callers depend on)
  2. ConcreteComponent (the base implementation)
  3. Decorator base class — implements Component, holds a Component
  4. ConcreteDecorators — each adds one feature

Use when:
  - cross-cutting concerns: logging, caching, retry, auth, metrics, validation
  - features are orthogonal (any subset can apply)
  - you'd otherwise need 2^N subclasses
  - composition needs to be runtime-determined

Don't use when:
  - the wrapping really changes the interface → that's Adapter
  - the wrapper gates access without enhancing → that's Proxy
  - there's only one feature ever → just put it in the base class

vs Inheritance: composition over subclasses; feature combinations are data
vs Adapter:    same interface (Adapter changes shape)
vs Proxy:      same interface (Proxy controls access; Decorator enhances)

Order matters: cache-outside-retry vs retry-outside-cache are different.
                logging-inside-auth vs logging-outside-auth has security
                implications.

TS @decorator syntax is RELATED but NOT THE SAME — it's a language feature
for declaration-time class transformation, often used for DI metadata.

Real-world: Express middleware, React HOCs, RxJS operators, Java I/O
            streams, NestJS interceptors, AWS Middy, retry/cache/auth
            wrappers around HTTP clients.
```
