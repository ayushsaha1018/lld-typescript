# 31 — Iterator Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, JS makes it feel native

---

## 1. Concept / Theory

**Iterator** provides a uniform way to **traverse a collection** sequentially without exposing the collection's underlying representation. The collection's internal structure (array, linked list, tree, hash map, paginated remote source) is hidden; clients only see a simple "give me the next element" interface.

### Why the pattern exists

Without Iterator, callers either:

* **Get the raw collection** (an array, a linked list's head node, a tree root) and write traversal logic themselves — duplicated everywhere, and the collection's structure leaks into every caller.
* **Have one collection per data source.** A tree exposes "preorder iteration" via one method, "postorder" via another, "by depth" via a third. The collection class explodes with traversal methods.

Iterator solves both: the collection exposes a way to *get an iterator*, and the iterator handles the traversal. Different traversal orders are different iterators over the same collection.

### Roles

* **Iterable** — the collection. Knows how to produce an Iterator.
* **Iterator** — the cursor. Has `next()` (and traditionally `hasNext()`).
* **Client** — calls `iterable.iterator()`, then loops calling `next()` until done.

```
   ┌───────────────┐                ┌────────────┐
   │   Iterable    │ ──creates──▶   │  Iterator  │
   │ + iterator()  │                │ + next()   │
   └───────────────┘                │ + done?    │
                                    └────────────┘
```

### The TypeScript / JavaScript native protocol

JS bakes Iterator into the language. An object is **iterable** if it has a `[Symbol.iterator]()` method that returns an **iterator** — an object with a `next(): { value, done }` method.

```ts
// minimal hand-rolled iterable
const myIterable = {
  [Symbol.iterator]() {
    let i = 0;
    return {
      next() {
        return i < 3 ? { value: i++, done: false } : { value: undefined, done: true };
      },
    };
  },
};

for (const x of myIterable) console.log(x);   // 0, 1, 2
[...myIterable];                               // [0, 1, 2]
const [a, b] = myIterable;                     // destructuring works
```

`for...of`, spread (`...`), array destructuring, `Array.from`, `Promise.all` — *all* of these consume the Iterator protocol. Implementing it on your own classes makes them first-class citizens of the language.

### Generators — the syntactic sugar that's a superpower

Generators (`function*`) let you *write* iterators using normal control flow.

```ts
function* range(start: number, end: number, step = 1) {
  for (let i = start; i < end; i += step) yield i;
}

for (const n of range(0, 10, 2)) console.log(n);   // 0, 2, 4, 6, 8
```

Generators are **lazy** — `yield` pauses execution; values aren't computed until requested. This makes them perfect for:

* **Infinite sequences** — `function* naturals() { let n = 0; while (true) yield n++; }`.
* **Tree traversal** — recursion + `yield*` is the cleanest tree iterator you'll ever write.
* **Pagination** — yield items as they're fetched; pause between API calls.
* **Backpressure** — only do work when the consumer asks for more.

### Async iteration (`for await...of`)

For iteration over async sources (paginated APIs, streams, websockets), JS has `Symbol.asyncIterator` and `for await...of`.

```ts
async function* paginatedFetch(url: string) {
  let next: string | null = url;
  while (next) {
    const res = await fetch(next);
    const json = await res.json();
    for (const item of json.items) yield item;
    next = json.nextUrl;
  }
}

for await (const user of paginatedFetch("/api/users")) {
  console.log(user);
}
```

This is the modern way to traverse paginated APIs, file streams, Mongo cursors, Kafka topics — anything where data arrives over time.

### The interview punchline

In pre-protocol languages (Java, C++, classic Python), Iterator pattern is a clear, ceremonial GoF pattern. In JS/TS, it's *built in* — but you should know **how** it's built in, what it solves, and how to implement it on your own classes. Interviewers will sometimes ask you to "implement your own iterator," meaning *do not use generators, write the protocol manually*.

---

## 2. Real-life Analogy

A **playlist's "next" button**. You don't open the file system, find the music files, and pick the next one yourself. The player keeps an internal cursor and exposes "next" / "previous." Whether the songs are stored as an array, a database query, or a Spotify API call doesn't matter to you.

Other clean analogies:

* **TV remote channel up/down.** You don't know whether channels are stored as a list, a tree, or fetched from cable head-end metadata. The remote gives you "next channel."
* **A book.** Turning pages is iteration. Rereading the book, you start a new iteration — the book itself didn't change, but the cursor restarted.
* **A deck of cards.** Drawing the top card is `next()`; the dealer doesn't show you the rest of the deck.
* **A queue at a restaurant.** Each customer comes one at a time; the host doesn't reveal the entire seating order.

---

## 3. Bad Code Example — Exposing the Collection's Innards

What happens when callers need to walk a collection and the collection doesn't offer iteration.

```ts
// ❌ BAD: clients read the internal array directly
class UserRepository {
  // public — leaking implementation
  public users: User[] = [];

  add(u: User) { this.users.push(u); }
}

// Every caller knows it's an array — and writes its own traversal
function emailAdmins(repo: UserRepository) {
  for (let i = 0; i < repo.users.length; i++) {
    if (repo.users[i].role === "admin") sendEmail(repo.users[i].email);
  }
}

function findFirstActive(repo: UserRepository) {
  for (let i = 0; i < repo.users.length; i++) {
    if (repo.users[i].isActive) return repo.users[i];
  }
}
```

What's wrong:

1. **Implementation leak.** Every caller knows `users` is an array. If you switch to a `Map<id, User>` or a paginated DB query, every caller breaks.
2. **Duplicated traversal logic.** Every loop is hand-written; bugs and inconsistencies pile up.
3. **No lazy iteration.** Even if you only need the first match, the entire array is potentially scanned by every caller.
4. **No multiple traversals.** Two consumers iterating in parallel (e.g., snapshot vs streaming) can't do so cleanly.
5. **No abstraction over heterogeneous sources.** A `UserRepository` backed by a DB cursor and one backed by an in-memory list should look the same to callers — but here they couldn't.

---

## 4. Good Code Example — Iterator in TypeScript

### 4a. Native iterable with `Symbol.iterator`

```ts
class UserCollection implements Iterable<User> {
  private users: User[] = [];

  add(u: User) { this.users.push(u); }

  [Symbol.iterator](): Iterator<User> {
    let i = 0;
    const data = this.users;
    return {
      next(): IteratorResult<User> {
        if (i < data.length) return { value: data[i++], done: false };
        return { value: undefined as any, done: true };
      },
    };
  }
}

const repo = new UserCollection();
repo.add({ id: "1", name: "Ayush", role: "admin", isActive: true } as User);
repo.add({ id: "2", name: "Riya",  role: "user",  isActive: false } as User);

for (const u of repo) console.log(u.name);     // Ayush, Riya
const all = [...repo];                          // [u1, u2]
const [first] = repo;                           // u1
```

The class is now a first-class member of the language. `for...of`, spread, destructuring, `Array.from(repo)` all work.

### 4b. Generator form (the modern idiom)

The `Symbol.iterator` ceremony shrinks dramatically with a generator:

```ts
class UserCollection {
  private users: User[] = [];
  add(u: User) { this.users.push(u); }

  *[Symbol.iterator](): IterableIterator<User> {
    for (const u of this.users) yield u;
  }
}
```

That's the entire iterator. Generators handle all the `next() / done` plumbing. Same external usage; less code.

### 4c. Multiple traversal orders

A tree class can expose multiple iterators — DFS, BFS, by depth — without picking a single canonical order.

```ts
class TreeNode<T> {
  constructor(public value: T, public children: TreeNode<T>[] = []) {}

  // Depth-first preorder
  *preorder(): Iterable<T> {
    yield this.value;
    for (const c of this.children) yield* c.preorder();
  }

  // Depth-first postorder
  *postorder(): Iterable<T> {
    for (const c of this.children) yield* c.postorder();
    yield this.value;
  }

  // Breadth-first
  *bfs(): Iterable<T> {
    const queue: TreeNode<T>[] = [this];
    while (queue.length) {
      const node = queue.shift()!;
      yield node.value;
      queue.push(...node.children);
    }
  }
}

const tree = new TreeNode("A", [
  new TreeNode("B", [new TreeNode("D"), new TreeNode("E")]),
  new TreeNode("C", [new TreeNode("F")]),
]);

console.log([...tree.preorder()]);   // ["A","B","D","E","C","F"]
console.log([...tree.postorder()]);  // ["D","E","B","F","C","A"]
console.log([...tree.bfs()]);        // ["A","B","C","D","E","F"]
```

`yield*` in `preorder` recursively yields from a child's iterator — a beautiful one-liner that would be a complex stack-and-state class in Java.

### 4d. Lazy / infinite sequences

Generators shine when the data is large or infinite — values are computed on demand.

```ts
function* fibonacci(): Generator<number> {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

function* take<T>(it: Iterable<T>, n: number): Iterable<T> {
  let i = 0;
  for (const x of it) {
    if (i++ >= n) return;
    yield x;
  }
}

const first10 = [...take(fibonacci(), 10)];   // [0,1,1,2,3,5,8,13,21,34]
```

`fibonacci` is conceptually infinite. `take(fibonacci(), 10)` produces the first 10 — no infinite loop, no precomputed array. This is the foundation of lazy data pipelines.

### 4e. Async iterator — paginated API

```ts
async function* fetchAllUsers(): AsyncIterableIterator<User> {
  let pageToken: string | undefined;
  do {
    const res = await fetch(`/users?pageToken=${pageToken ?? ""}`);
    const { items, nextPageToken }: { items: User[]; nextPageToken?: string } = await res.json();
    for (const u of items) yield u;
    pageToken = nextPageToken;
  } while (pageToken);
}

// Caller treats it like a normal sequence
for await (const u of fetchAllUsers()) {
  if (u.role === "admin") await alertAdmin(u);
}
```

The caller doesn't know or care that there are 50 users per page, that pagination uses tokens, that fetch is async. They iterate. Async work happens transparently.

This is how the GitHub Octokit, AWS SDK paginators, Mongo cursors, and Stripe pagination clients are built.

### 4f. Composing iterators (lazy data pipelines)

Iterators compose into pipelines — `map`, `filter`, `take`, `flatMap` — without ever materializing intermediate arrays.

```ts
function* map<T, U>(it: Iterable<T>, fn: (x: T) => U): Iterable<U> {
  for (const x of it) yield fn(x);
}
function* filter<T>(it: Iterable<T>, p: (x: T) => boolean): Iterable<T> {
  for (const x of it) if (p(x)) yield x;
}

const adminEmails = [...take(
  map(
    filter(repo, u => u.role === "admin"),
    u => u.email,
  ),
  100,
)];
```

This is what RxJS, Lodash `_.chain`, and JS's experimental `Array.fromAsync` operate on. The pipeline pulls one element at a time, so a `take(100)` on a 10M-row source actually does ~100 worth of work.

### 4g. Hand-rolled (no generator) — what interviewers may demand

If asked to "implement Iterator without generators," it's just the protocol explicitly:

```ts
class RangeIterator implements Iterator<number> {
  constructor(private current: number, private end: number, private step: number) {}
  next(): IteratorResult<number> {
    if (this.current >= this.end) return { value: undefined as any, done: true };
    const v = this.current;
    this.current += this.step;
    return { value: v, done: false };
  }
}

class RangeIterable implements Iterable<number> {
  constructor(private start: number, private end: number, private step = 1) {}
  [Symbol.iterator](): Iterator<number> {
    return new RangeIterator(this.start, this.end, this.step);
  }
}

for (const n of new RangeIterable(0, 10, 2)) console.log(n);
```

Note that **a fresh iterator is returned per call to `[Symbol.iterator]()`**. That means two parallel `for...of` loops on the same iterable each get their own cursor — they don't trample each other. This is a subtle but important property.

---

## 5. Real-world Use Cases

* **Native JS / TS** — `for...of`, `for await...of`, spread, destructuring, `Array.from`, `Map.entries()`, `Set.values()`, `String[Symbol.iterator]()`. Every iterable in the language is the Iterator pattern.
* **Generators** — `function*`. Lazy sequences, coroutines, state machines.
* **Async iterators** — `for await`, async generators. Mongo cursors, Stripe pagination, GitHub Octokit pagination, AWS SDK paginators.
* **Database cursors** — Postgres streaming queries, Mongo `find().cursor()`, MySQL streams. The DB hands you an iterator over potentially huge result sets without loading them all into memory.
* **File streams** — Node's `Readable` streams are iterable. `for await (const chunk of fs.createReadStream(file)) ...`.
* **DOM `NodeList`** — `document.querySelectorAll(".item")` returns an iterable.
* **Kafka consumers, RabbitMQ subscribers** — consumed via async iterators in modern client libs.
* **GraphQL pagination connections** — Relay-style cursors.
* **Lazy collection libraries** — lazy.js, lodash's lazy `_.chain`, RxJS (closely related — observables are push-based iterators).
* **In-memory tree / graph traversal** — DOM walking (`TreeWalker`), file system recursive walking (`fs.opendir`), AST visitors.
* **Pagination over remote APIs** — GitHub, Stripe, Twilio, AWS — all expose paginators that fit cleanly into an async iterator.
* **Event systems** — async generators have replaced some event-emitter use cases (`for await (const e of events) ...`).

In any modern TS codebase, *every* `for...of` is using the Iterator pattern. Most developers never write a custom one because the protocol "just works" via generators.

---

## 6. Interview Questions

### Q1. What's the difference between an Iterator and a Generator?

**Answer:** An **Iterator** is *any* object that conforms to the iterator protocol — i.e., has a `next()` method that returns `{ value, done }`. A **Generator** is one specific *way* to create iterators: a function declared with `function*` that uses `yield`.

Generators are syntactic sugar for the protocol. The function body's natural control flow becomes the iterator's `next()` behavior — `yield x` produces `{ value: x, done: false }`, `return` produces `{ done: true }`. The runtime suspends and resumes the function for you.

Other ways to create iterators:
* Hand-write an object with `next()` (verbose but explicit).
* Use built-in iterables (`Array`, `Map`, `Set`, `String`).
* Wrap an existing iterable in a transforming generator.

The relationship: **every Generator is an Iterator; not every Iterator is a Generator.** Generators just make iterators easier to write.

---

### Q2. Implement a tree that supports both DFS and BFS iteration.

**Answer:** (See section 4c.) Key points:

1. The tree class exposes **multiple `*` methods**: `preorder()`, `postorder()`, `bfs()`. Each is a separate iterator, returning a different traversal order.
2. **`yield*` in DFS** elegantly delegates to a child's iterator — no manual stack management.
3. **BFS uses an explicit queue** (FIFO) and yields as it dequeues. DFS-iterative would use an explicit stack (LIFO).
4. **Each call to `tree.preorder()` returns a fresh iterator.** Two parallel iterations don't interfere.

Senior signals to mention:

* **Memory.** BFS holds the whole frontier in the queue (potentially wide). DFS holds only the path (linear in depth). Pick traversal based on memory budget.
* **Lazy.** Because the iterators are generators, a `for...of` that breaks early stops the work — `[...tree.bfs()].slice(0, 5)` does the whole traversal, but `take(tree.bfs(), 5)` does only what's needed.
* **Visitor pattern combo.** If callers want to do different things per node type, pair Iterator with Visitor. Iterator exposes the traversal; Visitor encapsulates per-node behavior.

---

### Q3. Walk me through writing a paginated async iterator over an API.

**Answer:** (See section 4e.) The pattern:

```ts
async function* fetchAll<T>(url: string, parse: (j: any) => { items: T[]; next?: string }) {
  let nextUrl: string | undefined = url;
  while (nextUrl) {
    const res = await fetch(nextUrl);
    const j = await res.json();
    const { items, next } = parse(j);
    for (const item of items) yield item;
    nextUrl = next;
  }
}

// Caller treats it as a flat sequence
for await (const user of fetchAll<User>("/api/users", j => ({ items: j.users, next: j.nextUrl }))) {
  if (user.role === "admin") notifyAdmin(user);
}
```

Things the interviewer wants to hear:

1. **Async generator** with `for await...of` consumption — the modern idiom.
2. **Pagination state** (`nextUrl` / `pageToken`) is private to the iterator, hidden from callers.
3. **Caller never sees the page boundaries** — they get a flat stream of items.
4. **Lazy fetching** — only fetches the next page when the consumer asks for the next item past the current page's tail. If the consumer breaks early, no further fetches happen.
5. **Cancellation** — pass an `AbortSignal` to `fetch` so callers can cancel mid-iteration. The senior version of this answer always mentions cancellation.
6. **Errors propagate normally** — a failed `fetch` throws inside the generator and surfaces in the consumer's `try/catch`.
7. **Backpressure for free** — if the consumer is slow, the producer waits.

This pattern is how every modern SDK exposes pagination. The consumer gets `for await` ergonomics; the SDK hides REST-vs-GraphQL-vs-cursor differences.

---

### Q4. Why is iteration order an interesting design choice for a collection class?

**Answer:** Because the *same* underlying data structure can support multiple orderings, and forcing one is a leak.

Examples:

* **A tree** can be iterated DFS-pre, DFS-post, BFS, level-order, by-depth-bounded — five different orderings, all valid, none "canonical."
* **A `Set`** could iterate in insertion order (JS does this), insertion-reverse, sorted, or random.
* **A user repository** might iterate by id, by signup date, by last activity. Different consumers care about different orders.

The clean design: the collection exposes **multiple iterators**, each named for its order (`tree.preorder()`, `tree.bfs()`, `users.byActivity()`). Picking one as the default `[Symbol.iterator]` is a separate decision — `for...of` users get that one, but the others are explicitly available.

The smell: a collection with one iteration order *and* a flag like `setIterationMode("dfs" | "bfs")`. That's a single iterator pretending to be many; it muddles the API and breaks the "fresh iterator per call" property.

---

### Q5. When does Iterator pattern not pay off?

**Answer:** A few cases:

1. **The data is small and statically known.** A 5-element list doesn't need an iterator abstraction. Use the array directly.
2. **You need random access, not sequential.** Iterator is sequential by design. If callers need `collection[42]`, use array/index access. (Iterators can be combined with seeking, but that's reaching.)
3. **The collection has only one possible traversal order and clients are expected to know the structure.** Sometimes the collection *is* the API — a 2D grid where (row, col) access is natural. Forcing iteration on top adds noise.
4. **Performance-critical inner loops.** A protocol call per element (even with generators) has overhead vs a tight for-loop over an array. Profile before assuming. JIT helps a lot, but in numerical/tight loops, raw arrays often win.
5. **The "iteration" is really a query.** If callers say "give me admins" and you iterate filtering on each call, you're paying linear cost when an indexed lookup or a query language (SQL, Mongo find) would do the work upfront.

The honest framing: Iterator is the *cleanest* abstraction over sequential access. In JS specifically, it's almost free to implement (one generator method) and gives the language's iteration features for free. The cases where it doesn't pay off are mostly performance and "the data isn't really sequential."

---

## TL;DR Cheat Sheet

```
Iterator: traverse a collection sequentially without exposing its
          internal representation.

JS protocol (built-in):
  - Iterable: object with a [Symbol.iterator]() method
  - Iterator: object with a next(): { value, done } method
  - for...of, spread, destructuring all consume the protocol
  - Async: [Symbol.asyncIterator]() + for await...of

Generators (function*) — write iterators with normal control flow:
  - yield x       → produces { value: x, done: false }
  - return        → produces { done: true }
  - yield* iter   → delegate to another iterable
  - async function* → for await...of consumers

Use when:
  - hide collection internals (array vs map vs tree vs API)
  - support multiple traversal orders (DFS / BFS / by-date)
  - lazy / infinite sequences
  - pagination (sync or async)
  - composable transforms (map, filter, take pipelines)

Don't use when:
  - small, statically-known data — array is fine
  - random access is needed
  - performance-critical inner loops
  - data isn't really sequential (it's a query)

Key properties:
  - Each call to [Symbol.iterator]() returns a FRESH iterator → safe
    for parallel iteration on the same iterable.
  - Generators are lazy: yields produce values on demand.
  - yield* lets recursion express tree traversal in one line.
  - for await...of + abort signals = cancellable streams.

Real-world: native JS for...of, generators, async generators, DB cursors
            (Mongo, Postgres streaming), file streams, paginated APIs
            (GitHub, Stripe, AWS), DOM NodeList, RxJS observables, lazy
            data pipelines.

Interview gold: tree iterator with DFS+BFS via generators; async
                generator over paginated API with abort/cancel; explain
                Iterator vs Generator clearly.
```
