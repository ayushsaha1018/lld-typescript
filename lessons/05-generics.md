# Lesson 05 — Generics

> **Phase 1 — TypeScript for LLD**
> Write code that works for *any* type, without giving up type safety. Generics are the difference between "reusable" and "reusable *and* correct".

---

## 1. Concept / Theory

### The problem generics solve

Suppose you're writing a function that returns the first element of an array.

```ts
function firstAny(arr: any[]): any { return arr[0]; }

const n = firstAny([1, 2, 3]);     // n: any  ❌ lost the type
const s = firstAny(["a", "b"]);    // s: any  ❌ lost the type

n.toUpperCase();                   // compiles. Crashes at runtime.
```

`any` works — but it throws away every guarantee TypeScript exists to give you. The caller would have to manually re-narrow.

The fix is a **type variable** (a generic):

```ts
function first<T>(arr: T[]): T { return arr[0]; }

const n = first([1, 2, 3]);    // n: number  ✅
const s = first(["a", "b"]);   // s: string  ✅
```

`<T>` declares a placeholder type. TS *infers* what `T` is from the call site. At the call sites above, `T` becomes `number` and `string` respectively. The function is **one implementation**; it serves **infinite types**.

### What "generic" really means

A generic is a parameter that takes a **type** instead of a **value**. Just like a function takes runtime values and returns a runtime value, a generic takes types and produces a *type-safe shape*.

```ts
function identity<T>(x: T): T { return x; }   // T is the "type argument"

identity<string>("hi");   // explicit
identity(42);              // inferred — T = number
```

Generics show up in three places:

1. **Generic functions** — `function map<T, U>(arr: T[], fn: (x: T) => U): U[]`
2. **Generic classes** — `class Repository<T> { ... }`
3. **Generic types / interfaces** — `interface ApiResponse<T> { data: T; status: number; }`

### Generic constraints — narrowing what's allowed

A bare `<T>` accepts *anything*. Often you need to require that `T` has certain properties.

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest("hello", "hi");       // ✅ strings have .length
longest([1, 2, 3], [4, 5]);   // ✅ arrays have .length
longest(10, 20);              // ❌ numbers don't have .length
```

`T extends X` reads "T must satisfy X". Constraints are how generics stay safe — you can call `.length` inside `longest` because the constraint guarantees it.

### Default type parameters

```ts
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

const a: ApiResponse = { data: "any shape", status: 200 };  // T = unknown
const b: ApiResponse<User> = { data: user, status: 200 };   // T = User
```

Defaults give callers a "skip-it" option, like default function arguments.

### Multiple generics + relationships between them

```ts
function pluck<T, K extends keyof T>(obj: T, keys: K[]): T[K][] {
  return keys.map(k => obj[k]);
}

const user = { id: 1, name: "Ayush", age: 27 };
const cols = pluck(user, ["id", "name"]);   // cols: (number | string)[]
pluck(user, ["foo"]);                       // ❌ "foo" isn't a key of user
```

`K extends keyof T` ties `K` to the actual keys of `T`. The compiler now stops you from passing nonsense keys. This is one of the most useful patterns in real codebases.

### The mental model

Think of a generic class as a **template** the compiler stamps out:
- `Repository<User>` and `Repository<Order>` look like two different classes from the outside.
- Inside, there's exactly one source file. You wrote the logic once.

That's the win: **type safety without code duplication**.

---

## 2. Real-life Analogy

A **Tupperware container** is generic. The container is one design — but you can put rice in one, dal in another, biryani in a third. The container *doesn't care* what you put in; the *labels* tell anyone opening it what's inside.

```
Tupperware<Rice>     // labeled rice
Tupperware<Dal>      // labeled dal
Tupperware<Biryani>  // labeled biryani
```

Now contrast with `Tupperware<any>` — that's the unlabeled container in the back of the fridge. Could be soup. Could be paint. You'd have to taste it to find out, and that's the same energy as `any` in TS — fine until it's not.

A **constrained** generic is like *"Tupperware that fits in this drawer"* — `<T extends { height: number, width: number }>`. Still many shapes allowed, but with one guaranteed property: dimensions.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — `any` everywhere

```ts
// ❌ BAD: API "works" with any type, but caller gets no help
class Cache {
  private store: Record<string, any> = {};
  set(key: string, value: any) { this.store[key] = value; }
  get(key: string): any { return this.store[key]; }
}

const cache = new Cache();
cache.set("user:1", { id: 1, name: "Ayush" });
const u = cache.get("user:1");
u.email.toLowerCase();   // ❌ no error at compile, crashes at runtime
```

**Why it fails:**
- The caller has zero idea what they get back.
- `u.email` looks legal; TS can't catch it because `u: any`.
- Refactors silently break — rename `name` to `fullName` and TS won't help you find the consumers.

### Bad pattern B — duplicated classes per type

```ts
// ❌ BAD: copy-paste because we don't know about generics
class UserRepository {
  private items: User[] = [];
  add(u: User) { this.items.push(u); }
  findById(id: string): User | undefined { return this.items.find(x => x.id === id); }
}

class OrderRepository {
  private items: Order[] = [];                 // copy
  add(o: Order) { this.items.push(o); }        // copy
  findById(id: string): Order | undefined {    // copy
    return this.items.find(x => x.id === id);
  }
}
```

Same shape, copied N times. A bug in one means a bug in all.

### Bad pattern C — over-genericizing

```ts
// ❌ BAD: too many type parameters that nothing uses
class Service<T, U, V, W, X> {
  constructor(private a: T, private b: U) {}
  run(x: V): W | X { /* ... */ }
}

new Service<User, Db, Request, Response, Error>(user, db);  // unreadable
```

If a type parameter shows up in only one place, it's just an alias. Generics are best when they tie multiple slots together.

---

## 4. Good Code (the right way)

### Generic Cache

```ts
// ✅ GOOD: caller decides what's stored, full type safety
class Cache<T> {
  private store = new Map<string, T>();
  set(key: string, value: T) { this.store.set(key, value); }
  get(key: string): T | undefined { return this.store.get(key); }
}

const userCache = new Cache<User>();
userCache.set("u:1", { id: "1", name: "Ayush" });
const u = userCache.get("u:1");        // u: User | undefined
u?.email;                              // ❌ User has no `email` — caught at compile time
```

### Generic Repository — the pattern interviewers love

```ts
// ✅ GOOD: every entity that has an `id` can be stored generically
interface Identifiable { id: string; }

class Repository<T extends Identifiable> {
  private items = new Map<string, T>();

  save(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  findById(id: string): T | undefined {
    return this.items.get(id);
  }

  findAll(): readonly T[] {
    return [...this.items.values()];
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }
}

interface User extends Identifiable { name: string; }
interface Order extends Identifiable { total: number; }

const users  = new Repository<User>();
const orders = new Repository<Order>();

users.save({ id: "u1", name: "Ayush" });
orders.save({ id: "o1", total: 499 });

users.save({ id: "u2", total: 500 });   // ❌ User doesn't have `total`
```

What this shows:
- One implementation, two repositories — DRY.
- The `T extends Identifiable` constraint guarantees we can always read `item.id`.
- Saving the wrong shape is caught at **compile** time.
- This is the **Repository pattern**, popular in TypeORM, Prisma, and DDD codebases.

### Generic API client

```ts
interface ApiResponse<T> {
  data: T;
  status: number;
  error?: string;
}

class ApiClient {
  async get<T>(url: string): Promise<ApiResponse<T>> {
    const res = await fetch(url);
    return { data: await res.json() as T, status: res.status };
  }
}

const api = new ApiClient();
const res = await api.get<User>("/api/me");
res.data.name;       // ✅ typed as User.name
```

Note `<T>` is on the *method*, not the class — different calls return different shapes.

### `keyof` + generics — column picker

```ts
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

const user = { id: 1, name: "Ayush", age: 27 };
const minimal = pick(user, ["id", "name"]);   // type: { id: number; name: string }
pick(user, ["foo"]);                          // ❌ "foo" isn't a key
```

This is the kind of helper you'll see in libraries like `lodash.pick` — but typed correctly here. Compare with `lodash.pick`'s historical signature, which returned `Partial<T>` and lost precision.

### Generic factory with a constructor type

```ts
type Ctor<T> = new (...args: any[]) => T;

function create<T>(ClassRef: Ctor<T>, ...args: any[]): T {
  return new ClassRef(...args);
}

class Logger { constructor(public name: string) {} }
const l = create(Logger, "main");   // l: Logger
```

Useful for DI containers and frameworks. Mention this if asked about generic factories.

---

## 5. Real-world Use Cases

- **`Array<T>`, `Promise<T>`, `Map<K, V>`, `Set<T>`** — every JS built-in is generic. You use generics every day.
- **React hooks** — `useState<User | null>(null)`, `useReducer<Reducer<S, A>>(...)`, `useRef<HTMLDivElement>(null)`.
- **Express + types** — `Request<Params, ResBody, ReqBody, Query>`. The handler types are highly generic.
- **TypeORM / Prisma**: repositories are generic over the entity. Prisma uses a more elaborate generic mapping (`PrismaClient.user.findUnique`) but the same underlying idea.
- **NestJS** — guards, interceptors, and pipes are generic over the request/response shape.
- **Redux Toolkit** — `createSlice<State, ...>`, `PayloadAction<T>`. Typesafe payloads come from generics.
- **RxJS** — `Observable<T>`, `Subject<T>`, `BehaviorSubject<T>`.
- **GraphQL clients** — `useQuery<Data, Variables>(...)`. Both sides typed, end-to-end safety.

In short: any time you'd otherwise write `any`, the right answer is almost always `<T>`.

---

## 6. Interview Questions (with answers)

### Q1. *"What's the difference between `any`, `unknown`, and a generic `T`?"*

**Answer.**
- `any` — opt out of the type system entirely. You can do anything with an `any` and TS won't complain (and won't help).
- `unknown` — the **safe** counterpart of `any`. You can hold any value but you cannot use it without first narrowing (`if (typeof x === "string")` etc.).
- `T` — a placeholder for **a specific but currently unknown type**, decided by the caller. The function still works for many types, but inside the function, TS treats `T` consistently.

When in doubt, prefer `unknown` over `any`, and prefer `<T>` over `unknown` if you want the caller's type to flow through.

### Q2. *"Explain generic constraints with an example."*

**Answer.** A constraint (`T extends X`) requires the type variable to satisfy a particular shape. Inside the function/class, you can rely on that shape.

```ts
function logId<T extends { id: string }>(x: T): T {
  console.log(x.id);   // safe — constraint guarantees `id`
  return x;
}
```

Without the constraint, TS would complain about `x.id` because `T` could be any type, including types without `id`. Constraints turn generics from "anything goes" into "anything *that fits*".

### Q3. *"What does `<T extends keyof Foo>` mean, and where would you use it?"*

**Answer.** It means `T` must be one of the literal property names of `Foo`. Useful for typed accessors and pickers:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { id: 1, name: "Ayush" };
const n = getProp(user, "name");    // n: string
getProp(user, "email");             // ❌ 'email' not a key
```

This pattern shows up in form libraries (path-based getters), object pickers, and ORM query builders.

### Q4. *"Why doesn't this work?"*
```ts
function lengths<T>(items: T[]): number[] {
  return items.map(x => x.length);    // ❌ Property 'length' does not exist on type 'T'
}
```

**Answer.** Inside the function, `T` could be anything — `number`, `Date`, your custom class. TS won't let you call `.length` because nothing in the type system promised `T` has a `length`. Two fixes:

1. Add a constraint: `function lengths<T extends { length: number }>(items: T[])` — now every `T` is required to have `.length`.
2. If you only ever call this with strings or arrays, type-narrow at the boundary, or just accept `string[] | unknown[][]`.

The general rule: **anything you do to a generic value, you must justify with a constraint.**

### Q5. *"Compare type-level overloads to a generic. When would you pick one over the other?"*

**Answer.**
- **Generic** — one signature that handles a family of related types uniformly. Good when the *shape* of the operation is the same regardless of `T`.
  ```ts
  function first<T>(arr: T[]): T | undefined { return arr[0]; }
  ```
- **Overloads** — multiple distinct signatures that share a single implementation. Good when *behavior or return type genuinely differs* per input shape.
  ```ts
  function parse(s: string): string;
  function parse(s: string, asNumber: true): number;
  function parse(s: string, asNumber?: boolean): string | number {
    return asNumber ? Number(s) : s;
  }
  ```

If you find yourself writing many overloads with subtle differences, ask whether a generic with a conditional return type would express it more cleanly. Often yes.

### Q6 (advanced — bonus). *"What's a conditional type and where have you used one?"*

**Answer.** A conditional type chooses between two types based on a condition.

```ts
type IsArray<T> = T extends any[] ? true : false;
type A = IsArray<number[]>;   // true
type B = IsArray<string>;      // false
```

Real-world use: extracting a Promise's resolve type — `type Awaited<T> = T extends Promise<infer U> ? U : T`. (TS now ships `Awaited<T>` built-in.) These are deep TS waters; mention only if asked. For LLD interviews, generic basics + constraints + `keyof` are usually enough.

---

## Recap — what to remember

1. A generic is **a type parameter** — the caller picks the type, the implementation stays one piece of code.
2. Use generics on **functions, classes, and types/interfaces**.
3. **Constraints** (`T extends Foo`) make generics safe — without them you can do almost nothing inside the function.
4. **`keyof` + generics** is the go-to pattern for typed property access.
5. Generics show up everywhere in the LLD ecosystem — `Repository<T>`, `ApiResponse<T>`, `EventBus<T>`, `Cache<T>`. Knowing the pattern saves you from copy-paste classes.
6. **Don't over-genericize.** A type parameter used in only one slot is just an alias — drop it.
7. Always prefer `<T>` over `any`. Prefer `unknown` over `any` when you really don't know.

---

## What's next
Lesson 06 — **Static Members & Enums**: when statics are useful (and when they're a Singleton in disguise), and the enum vs union-type debate that has a clear winner in 2026.
