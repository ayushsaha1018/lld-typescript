# 27 — Observer Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, lots of practical nuance

---

## 1. Concept / Theory

**Observer** defines a **one-to-many dependency** between objects: when one object (the **Subject**, sometimes called Observable or Publisher) changes state, all its dependents (the **Observers** or Subscribers) are notified automatically.

The pattern shows up wherever you find one of these:

* "When X changes, I want N other things to react."
* "I want to broadcast events without my code knowing who listens."
* "Subscribers come and go; the producer shouldn't have to care."

```
                    ┌──────────────────┐
                    │     Subject      │
                    │ + subscribe(o)   │
                    │ + unsubscribe(o) │
                    │ + notify(...)    │
                    └────────┬─────────┘
                             │ holds 0..N observers
                             ▼
                    ┌──────────────────┐
                    │     Observer     │  (interface)
                    │ + update(data)   │
                    └────────┬─────────┘
                             △
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
      ┌──────────┐     ┌──────────┐     ┌──────────┐
      │ Observer1│     │ Observer2│     │ Observer3│
      └──────────┘     └──────────┘     └──────────┘
```

The Subject doesn't know what observers do; observers don't know about each other. The only contract is the `Observer` interface.

### Why this matters

Without Observer, you end up with **direct coupling** — every time you change something in module A, you have to add a manual call to modules B, C, D, E that depend on it. New dependent? Edit A. Remove a dependent? Edit A again. That's an Open/Closed Principle violation.

With Observer, A doesn't know what depends on it. A just emits events. New listeners subscribe; old ones unsubscribe. A is closed for modification.

### Two delivery models: Push vs Pull

* **Push** — the Subject sends the *new state* (or just the changed fields) directly to observers. Simple, efficient when observers always need the same data.
* **Pull** — the Subject just notifies observers that *something changed*; observers then query the Subject for whatever data they care about. More flexible when observers need different views of the data.

Push is more common and ergonomic in TS/JS. Pull shows up in the older Java AWT-style observer pattern.

### Synchronous vs asynchronous notification

Notifications can be:

* **Sync** — `subject.notify()` calls every observer's `update()` *in the same call stack*, in order. Simple, predictable, but a slow observer blocks all others, and an observer's exception propagates to the caller.
* **Async** — observers run on the next tick / microtask / event loop. Each observer is isolated; one slow or failing observer doesn't break others. But ordering and consistency become harder to reason about.

In most JS/TS event systems (DOM events, EventEmitter, Redux subscribers), notifications are sync by default — async only if the observer itself uses `setTimeout` or `Promise` internally.

### Memory leaks: the #1 Observer pitfall

If observers subscribe but never unsubscribe (e.g., a React component subscribes in `useEffect` but the cleanup is missing), they live as long as the Subject. The Subject holds a reference to them; the GC can't collect them. This is *the* most common bug in Observer code.

Mitigations: explicit `unsubscribe()` returned from `subscribe()`, weak references for long-lived subjects, framework-managed lifecycles (React's `useEffect` cleanup, RxJS's `Subscription.unsubscribe()`).

### Observer vs Pub/Sub (the interview confusion)

* **Observer** (GoF) — observers register *directly* with the Subject. Tight in-process binding. The Subject knows its observers (or at least their references).
* **Pub/Sub** — publishers and subscribers communicate through a *broker / event bus / topic system*. They don't know about each other; both only know the broker.

Pub/Sub is essentially Observer + Mediator. In small in-process scenarios, the line is blurry. At distributed scale (Redis pub/sub, Kafka, RabbitMQ, NATS), Pub/Sub is the only sensible model.

We'll cover the difference in detail in interview questions.

---

## 2. Real-life Analogy

**YouTube channels.** A creator (Subject) publishes a new video. Subscribers (Observers) get notified. New subscribers join freely; old ones unsubscribe. The creator doesn't know or care who's subscribed — they just upload, and YouTube handles fan-out.

Other clean analogies:

* **Magazine subscriptions.** Subscribe → magazine arrives every month. Cancel → it stops. The publisher doesn't track every reader's preferences, just maintains the list.
* **Stock tickers.** Anyone interested in `AAPL` registers; the exchange pushes price updates to all subscribers.
* **Smoke alarms in a building.** When one alarm trips, all others sound (in interconnected systems). Each alarm is an observer of "smoke detected" events.
* **News-app push notifications.** You opt in to "Tech," and any new tech article triggers a push to your phone.

---

## 3. Bad Code Example — Manual Wiring + Polling

Two classic anti-patterns: manually calling everyone who cares, and polling for changes.

```ts
// ❌ BAD: every "interested party" hard-coded into the producer
class Order {
  private state: "pending" | "paid" | "shipped" = "pending";

  pay() {
    this.state = "paid";
    // Manually notify every interested party
    new EmailService().sendPaymentConfirmation(this);
    new InventoryService().reserveStock(this);
    new AnalyticsService().recordEvent("payment", this);
    new LoyaltyService().awardPoints(this);
    new FraudDetector().scoreTransaction(this);
    // What if we add a new system tomorrow? EDIT THIS METHOD.
  }
}

// ❌ BAD: polling — observers checking the producer in a loop
class StockTickerPoller {
  start(symbol: string) {
    setInterval(async () => {
      const price = await fetchPrice(symbol);
      console.log(`Current ${symbol}: ${price}`);
    }, 1000);   // poll every second
  }
}
// Issues: wasted requests when no change happens; lag = poll interval;
//         doesn't scale to many symbols × many subscribers.
```

What's wrong:

1. **OCP violation in `Order.pay()`.** Adding a new dependent — say, a webhook to Slack — means editing `Order`. Every team that wants to react to a payment ends up modifying the core order class.
2. **Direct coupling.** `Order` depends on `EmailService`, `InventoryService`, `AnalyticsService`, ... — five dependencies for what should be one fact (`paid`).
3. **Polling is wasteful.** 99% of polls return the same value. Network and CPU burned for nothing.
4. **Lag.** With a 1-second poll interval, observers see changes up to 1 second late. Decreasing the interval increases waste linearly.

The Observer pattern fixes both: producers emit events; consumers subscribe. No polling, no hard-coded list of dependents.

---

## 4. Good Code Example — Observer in TypeScript

### 4a. Basic typed Observer

```ts
// ============================================================
// 1) Observer interface — what subscribers expose
// ============================================================
interface Observer<T> {
  update(data: T): void;
}

// ============================================================
// 2) Subject — manages subscribers and notifications
// ============================================================
class Subject<T> {
  private observers = new Set<Observer<T>>();

  subscribe(o: Observer<T>): () => void {
    this.observers.add(o);
    return () => this.unsubscribe(o);   // return cleanup function
  }

  unsubscribe(o: Observer<T>) {
    this.observers.delete(o);
  }

  notify(data: T) {
    for (const o of this.observers) {
      try {
        o.update(data);
      } catch (e) {
        // one observer throwing should not affect the others
        console.error("observer threw:", e);
      }
    }
  }
}

// ============================================================
// 3) Concrete Subject — Order, exposing payment events
// ============================================================
type OrderEvent = { orderId: string; state: "paid" | "shipped" };

class Order {
  private events = new Subject<OrderEvent>();

  onChange(o: Observer<OrderEvent>) { return this.events.subscribe(o); }

  constructor(public readonly id: string) {}

  pay() {
    // ... do the payment
    this.events.notify({ orderId: this.id, state: "paid" });
  }
  ship() {
    this.events.notify({ orderId: this.id, state: "shipped" });
  }
}

// ============================================================
// 4) Concrete Observers
// ============================================================
class EmailObserver implements Observer<OrderEvent> {
  update(e: OrderEvent) { console.log(`📧 email user about order ${e.orderId} → ${e.state}`); }
}
class AnalyticsObserver implements Observer<OrderEvent> {
  update(e: OrderEvent) { console.log(`📊 record ${e.state} for ${e.orderId}`); }
}
class InventoryObserver implements Observer<OrderEvent> {
  update(e: OrderEvent) {
    if (e.state === "paid") console.log(`📦 reserve stock for ${e.orderId}`);
  }
}

// ============================================================
// 5) Wiring — Order doesn't know who's listening
// ============================================================
const order = new Order("o-123");
const unsubEmail     = order.onChange(new EmailObserver());
const unsubAnalytics = order.onChange(new AnalyticsObserver());
const unsubInventory = order.onChange(new InventoryObserver());

order.pay();
// 📧 email user about order o-123 → paid
// 📊 record paid for o-123
// 📦 reserve stock for o-123

unsubEmail();   // user opted out of emails
order.ship();
// 📊 record shipped for o-123
// (no email!)
```

What's better:

* **`Order` doesn't know about observers.** New listener? `order.onChange(...)`. Zero `Order` changes.
* **Each observer is its own class** with one responsibility.
* **`subscribe()` returns the unsubscribe function** — much harder to forget cleanup.
* **One bad observer doesn't poison others.** The try/catch isolates failures.

### 4b. Type-safe Event Emitter (the workhorse)

In real TS code, you usually want multiple event types on one Subject. A typed event emitter handles this cleanly.

```ts
type EventMap = Record<string, unknown>;

class TypedEmitter<E extends EventMap> {
  private listeners: { [K in keyof E]?: Set<(payload: E[K]) => void> } = {};

  on<K extends keyof E>(event: K, fn: (payload: E[K]) => void): () => void {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof E>(event: K, fn: (payload: E[K]) => void) {
    this.listeners[event]?.delete(fn);
  }

  emit<K extends keyof E>(event: K, payload: E[K]) {
    this.listeners[event]?.forEach(fn => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }
}

// Define your events with their payload types
type AppEvents = {
  "order.paid":    { orderId: string; amount: number };
  "order.shipped": { orderId: string; trackingId: string };
  "user.signup":   { userId: string; email: string };
};

const bus = new TypedEmitter<AppEvents>();

bus.on("order.paid", e => {
  // e is fully typed as { orderId: string; amount: number } — no `any`
  console.log(`Paid: ${e.orderId} for $${e.amount}`);
});

bus.emit("order.paid", { orderId: "o-1", amount: 99 });   // OK
// bus.emit("order.paid", { foo: 1 });                    // ❌ TS error
// bus.emit("typo",       { orderId: "o" });              // ❌ TS error
```

This is genuinely production-grade. Every reasonable codebase ends up with something like this.

### 4c. Multi-topic Pub/Sub

When the producer and consumer don't know about each other, route through a broker keyed by topic.

```ts
class EventBus {
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  publish(topic: string, data: unknown) {
    this.listeners.get(topic)?.forEach(fn => {
      try { fn(data); } catch (e) { console.error(e); }
    });
  }

  subscribe(topic: string, fn: (data: unknown) => void): () => void {
    const set = this.listeners.get(topic) ?? new Set();
    set.add(fn);
    this.listeners.set(topic, set);
    return () => set.delete(fn);
  }
}

const bus = new EventBus();

// In the order module
bus.publish("order.paid", { orderId: "o-1" });

// In the analytics module — has no idea who publishes "order.paid"
bus.subscribe("order.paid", e => console.log("analytics:", e));

// In the loyalty module — also no idea
bus.subscribe("order.paid", e => console.log("loyalty:", e));
```

Now the order module doesn't even know `analytics` or `loyalty` exist. They share only the topic name `"order.paid"` and an agreed-upon payload shape.

### 4d. Observer + Decorator: a logging observer

```ts
class LoggingObserverDecorator<T> implements Observer<T> {
  constructor(private inner: Observer<T>, private label: string) {}
  update(data: T) {
    console.log(`[${this.label}] received:`, data);
    this.inner.update(data);
  }
}

order.onChange(new LoggingObserverDecorator(new EmailObserver(), "email"));
```

You can stack patterns. Logging or retrying observers is just Decorator over Observer.

### 4e. Async observer dispatch

If you don't want a slow observer blocking the rest:

```ts
notify(data: T) {
  for (const o of this.observers) {
    queueMicrotask(() => {
      try { o.update(data); } catch (e) { console.error(e); }
    });
  }
}
```

Each observer runs in its own microtask. One slow or throwing observer can't stall the others. Trade-off: ordering between subject and observer is no longer guaranteed within the same tick.

---

## 5. Real-world Use Cases

* **DOM `addEventListener`** — every browser event is Observer. `button.addEventListener("click", handler)` registers an observer on a Subject (the button).
* **Node.js `EventEmitter`** — `emitter.on("data", ...)` is Observer at the platform level.
* **RxJS Observables** — the entire library is Observer pattern with operators built on top.
* **Redux store subscribers** — `store.subscribe(listener)` is the API. RTK's `useSelector` builds on top of this.
* **React's reactivity** — under the hood, hooks like `useState`, `useContext`, `useSyncExternalStore` register the component as an observer. When state changes, the framework notifies and re-renders.
* **Vue 3 / MobX / Solid / Valtio** — fine-grained reactivity; effects subscribe to the specific properties they read.
* **WebSocket / Server-Sent Events** — `socket.onmessage` is Observer for server-pushed messages.
* **PubSub messaging systems** — Redis pub/sub, Kafka, RabbitMQ, NATS, AWS SNS/SQS, Google Pub/Sub. Distributed Observer.
* **Browser APIs** — `IntersectionObserver`, `MutationObserver`, `ResizeObserver`, `PerformanceObserver`. Literally named after the pattern.
* **Promise `.then(...)`** — a one-shot observer. Resolving the promise notifies all `then` callbacks.
* **Signal libraries** — Solid.js signals, Preact signals, Angular signals. Observer with extreme granularity.
* **Spreadsheet recalculation** — when a cell changes, all dependent cells (observers) recompute.
* **Logging frameworks with multiple sinks** — log a line, every sink (file, stdout, Sentry) gets it.
* **MVC frameworks** — the View observes the Model and re-renders on change.
* **Webhooks** — the inverse-internet version of Observer: external services subscribe to your events via URL.
* **Hot module replacement / file watchers** — `chokidar.watch(file).on("change", reload)`.

When in doubt: if there's a `subscribe`, `addListener`, `on`, `addEventListener`, `watch`, `observe`, or `emit` in the API, it's Observer.

---

## 6. Interview Questions

### Q1. What's the difference between Observer and Pub/Sub?

**Answer:** They're closely related but operate at different scales.

* **Observer** (GoF) — observers register *directly* with the Subject. The Subject keeps a list of observer references. In-process, tight binding, simple. Both sides know each other (Subject knows observer references; observers know the Subject).
* **Pub/Sub** — publishers and subscribers communicate through a *broker* (event bus, topic system, message queue). They don't know about each other. Both sides only know the broker and the topic name.

Mechanical test:

* If module A does `b.subscribe(this)`, that's Observer (A holds a reference to B).
* If module A does `bus.subscribe("topic", handler)`, that's Pub/Sub (A and the publisher of `"topic"` may have no compile-time knowledge of each other).

In small in-process apps the line is blurry — a typed event emitter sits between the two. At distributed scale (across services, machines, queues), Pub/Sub is the only viable model.

Pub/Sub is essentially **Observer + Mediator**: a Mediator (the broker) coordinates many publishers and many subscribers without them knowing each other.

---

### Q2. What's the most common bug in Observer code, and how do you prevent it?

**Answer:** **Memory leaks from forgetting to unsubscribe.**

Pattern: an object subscribes to a long-lived Subject and never unsubscribes. The Subject keeps a reference to the observer; the GC can't collect either. In long-running apps this leaks memory monotonically.

Most common offender in frontend: a React component subscribes in `useEffect` and forgets the cleanup:

```ts
// ❌ leaks: never unsubscribes
useEffect(() => {
  store.subscribe(handler);
}, []);

// ✅ cleans up on unmount
useEffect(() => store.subscribe(handler), []);   // returns unsub fn directly
```

Mitigations:

1. **Return the unsubscribe function from `subscribe()`** — much harder to forget than calling `subject.unsubscribe(this)` later.
2. **Use framework-managed lifecycles** — `useEffect` cleanup, RxJS `Subscription.unsubscribe()`, Vue's `onUnmounted`.
3. **WeakRef / WeakMap** for very-long-lived Subjects, so observers are GC-eligible even if the Subject still has them.
4. **`AbortController`** is the modern JS-native way: `addEventListener("click", fn, { signal: ctrl.signal })`. One `ctrl.abort()` cancels all subscriptions tied to that controller.

The senior framing: any Observer API that doesn't return a cancellation handle is a leak waiting to happen.

---

### Q3. What happens if one observer throws? How should the Subject handle it?

**Answer:** It depends on the contract you're providing, but the *default* should be: **isolate the failure.** One observer's exception should not abort the rest of the dispatch.

The recommended implementation:

```ts
notify(data) {
  for (const o of this.observers) {
    try { o.update(data); } catch (e) { /* log, swallow */ }
  }
}
```

Why isolate? Because observers are *independent* by design — they don't know about each other. If observer #2 throws, observer #3 still has a legitimate need to be notified. Letting #2's exception bubble up and skip #3 silently couples them via failure semantics.

Alternative designs you might see (and trade-offs):

* **Log to a central error reporter** (Sentry, Datadog) inside the catch. Standard production move.
* **Bubble specific exceptions up** if you want the Subject to enforce contracts (e.g., "any observer throwing means the event is invalid"). Rarely the right call.
* **Async dispatch** (`queueMicrotask`) so each observer runs in its own task and their failures are inherently isolated, surfacing in the unhandled-promise-rejection or unhandled-exception flow.

Node's `EventEmitter` historically did *not* isolate — a thrown listener would crash the process. That's why `'error'` events have special handling (must have at least one listener or the process crashes). Modern frameworks (RxJS, EventEmitter3, web event listeners) isolate by default.

---

### Q4. Walk me through implementing a typed Pub/Sub for our app.

**Answer:** I'd start by defining the event map — every event with its payload type.

```ts
// 1. The schema
type AppEvents = {
  "order.paid":    { orderId: string; amount: number; currency: "USD" | "INR" };
  "order.shipped": { orderId: string; trackingId: string };
  "user.signup":   { userId: string; email: string };
  "user.deleted":  { userId: string };
};

// 2. The bus
class TypedEventBus<E extends Record<string, unknown>> {
  private listeners: { [K in keyof E]?: Set<(p: E[K]) => void> } = {};

  on<K extends keyof E>(event: K, fn: (p: E[K]) => void): () => void {
    (this.listeners[event] ??= new Set()).add(fn);
    return () => this.listeners[event]?.delete(fn);
  }

  emit<K extends keyof E>(event: K, payload: E[K]) {
    this.listeners[event]?.forEach(fn => {
      try { fn(payload); } catch (e) { errorReporter.capture(e); }
    });
  }
}

// 3. The singleton (or DI-injected) instance
export const bus = new TypedEventBus<AppEvents>();

// 4. Producers
class OrderService {
  pay(order: Order, amount: number) {
    // ... do the payment
    bus.emit("order.paid", { orderId: order.id, amount, currency: "USD" });
  }
}

// 5. Consumers
class LoyaltyService {
  constructor() {
    bus.on("order.paid", e => this.awardPoints(e.orderId, e.amount));
  }
  private awardPoints(_orderId: string, _amount: number) { /* ... */ }
}

class EmailService {
  constructor() {
    bus.on("order.paid", e => this.sendReceipt(e.orderId));
    bus.on("user.signup", e => this.sendWelcome(e.email));
  }
  private sendReceipt(_orderId: string) { /* ... */ }
  private sendWelcome(_email: string)  { /* ... */ }
}
```

Things the interviewer wants to hear:

1. **Type safety throughout.** Misspelled event names or wrong payload shapes are TS errors.
2. **`emit` returns nothing** — fire and forget. Producers don't know who's listening.
3. **`on` returns the unsubscribe function** — leak prevention.
4. **Failure isolation** in `emit` — one bad listener doesn't break others.
5. **Easily testable** — in tests, instantiate a fresh bus and assert that events get emitted.

Senior-signal extensions:

* **Wildcard subscriptions** for cross-cutting concerns (logging, audit) — `bus.onAny(fn)`.
* **Async-friendly variant** — `emitAsync` that awaits handlers and surfaces errors per handler. Useful for transactional integration tests.
* **Out-of-process variant** — when the app outgrows in-process, swap the bus for one backed by Redis/Kafka. Same API, distributed delivery.
* **Schema versioning** — events are part of your contract; treat them with the same care as API endpoints.

---

### Q5. Push vs Pull observers — which one and why?

**Answer:** Both are valid; the choice depends on what observers actually need.

* **Push** — Subject sends data with the notification: `observer.update(data)`. Simple, ergonomic. Best when:
  * Observers usually need the same data the Subject is broadcasting.
  * The data is small and known.
  * The Subject *can* compute the data efficiently.

* **Pull** — Subject just notifies that something changed; observers query the Subject for what they need: `observer.update(); observer.somethingNeeded = subject.getX();`. Best when:
  * Observers each need different views of the data.
  * Computing the full payload is expensive and not all observers need everything.
  * The data is mutable and observers want freshly-computed values at their own time.

In practice **push wins** in JS/TS event systems because:

1. JS objects/arrays can carry arbitrary shape — there's no need to "limit" payload like in old typed systems.
2. Async observers want a snapshot of *what was true when the event fired*, not what's true at the moment the observer runs (which pull would give them).
3. Pull-based observation tends to invite race conditions (Subject changes again between notify and pull).

When you do see pull, it's typically in **fine-grained reactive systems** (signals, MobX) where the "Subject" is a value cell and observers query just the bits they care about — but even there the "pull" is mediated through the framework, which keeps it consistent.

Interview-ready answer: "Push by default; pull only when observers need different views or the payload is genuinely too expensive to push."

---

## TL;DR Cheat Sheet

```
Observer: one-to-many dependency. When Subject changes, all Observers
          are notified automatically.

Recipe:
  1. Subject — manages observer list, exposes subscribe/unsubscribe/notify
  2. Observer interface — a single update(data) method
  3. Concrete Observers — react to events
  4. subscribe() should return an unsubscribe function

Use when:
  - one event needs to fan out to many handlers
  - the producer shouldn't know who listens
  - you'd otherwise need to manually wire each dependent

Pitfalls:
  - Memory leaks: missing unsubscribe (use returned cancel fn / AbortController)
  - One observer throwing breaking the rest (try/catch around each)
  - Polling instead of subscribing
  - Unbounded synchronous chains causing infinite-loop notifications

Push vs Pull:
  - Push (Subject sends data) — default in modern JS/TS
  - Pull (observers query Subject) — when payloads are heavy or differ

Sync vs Async:
  - Sync — predictable order, slow/throwing observer affects others
  - Async (queueMicrotask) — isolated, but ordering becomes unpredictable

Observer vs Pub/Sub:
  - Observer: direct subject ↔ observer reference
  - Pub/Sub:  broker between publishers and subscribers, topic-keyed

Combines well with:
  - Decorator: logging/retrying observers
  - Mediator: pub/sub via a central broker
  - Composite: an observer that contains observers (fan-out)

Real-world: addEventListener, EventEmitter, RxJS, Redux subscribe,
            React hooks, MutationObserver/IntersectionObserver, signals,
            WebSocket onmessage, Promise.then, webhooks, Kafka/Redis pub-sub.

Interview gold: "I'd model the producer as a typed event bus with
                 subscribe returning a cancellation function, isolate
                 observer failures with try/catch in the dispatch loop,
                 and prefer push delivery unless payloads are heavy."
```
