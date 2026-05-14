# 23 — Facade Pattern

> Phase 4 — Design Patterns → Structural
> Pattern type: Structural
> Difficulty: Conceptually easy, judgement-heavy in practice

---

## 1. Concept / Theory

**Facade** provides a single, simplified entry point to a *complex subsystem*. The client talks to the facade; the facade orchestrates the messy collaboration between many internal classes.

The pattern shows up whenever:

* A common operation requires **calling several classes in a specific sequence**.
* You want to **hide implementation details** of a complex library or subsystem from your callers.
* You want to **reduce coupling** between client code and a subsystem — the client depends only on the Facade, not on every internal class.
* You're integrating a **third-party library with a sprawling API** and only need a small slice of it.

```
                     ┌─────────────┐
                     │   Client    │
                     └──────┬──────┘
                            │ depends on Facade only
                            ▼
                     ┌─────────────┐
                     │   Facade    │
                     └──────┬──────┘
                            │ delegates to
              ┌─────────────┼─────────────┬──────────────┐
              ▼             ▼             ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐   ┌──────────┐
        │  ClassA  │  │  ClassB  │  │  ClassC  │   │  ClassD  │
        └──────────┘  └──────────┘  └──────────┘   └──────────┘
                          (the subsystem)
```

The facade *itself* doesn't usually contain meaningful business logic. It's a coordinator: it sequences calls to the subsystem, sometimes does light translation between client-friendly types and internal types, and exposes a small, intentional API.

### Three forces behind the pattern

1. **Cognitive load.** Subsystems with 30 classes are exhausting to use directly. The facade exposes 3–5 methods that map to the *use cases* clients actually care about.
2. **Decoupling.** If the subsystem is restructured internally, only the facade changes — clients don't.
3. **Discoverability.** A facade documents the subsystem's intended use. New developers read its methods to learn what the system can *do*, not what it *contains*.

### Clear boundaries — what Facade is NOT

* Not Adapter. Adapter changes one class's interface to fit another. Facade synthesizes one entry point over **many** classes.
* Not Decorator. Decorator preserves the interface and adds behavior. Facade introduces a **new, simpler** interface.
* Not Mediator. Mediator coordinates **peer** components that talk through it. Facade is one-directional — clients call into the facade, but the facade doesn't broker among the subsystem classes; it just orchestrates them.

### The risk: God Class drift

A facade can quietly grow into a god class. Symptoms: 50+ methods, knows about every part of the system, "the place where new methods always go." The fix is to split it by use case — `OrderCheckoutFacade` and `OrderRefundFacade` are two facades over the same subsystem, each scoped to one purpose.

We'll address this directly in the interview questions because it's a favorite probe.

---

## 2. Real-life Analogy

A **hotel reception desk**. You walk in and say, "I'd like to check in for Reservation #1234." Behind that one request:

* Housekeeping is told to prep the room.
* Billing pre-authorizes your card.
* Security issues a key card.
* The valet is notified to take your luggage.
* The concierge logs your dietary preferences for breakfast.

You don't visit five different counters. You don't know the housekeeping rota or the billing system's API. The receptionist is the Facade.

Other clean analogies:

* **Restaurant waiter.** You order "spaghetti carbonara." They translate that into instructions for the chef, the line cook, the dishwasher, the inventory system, and the bill at the end. You see a friendly menu; the kitchen sees a complex workflow.
* **TV remote.** One "Power" button hides voltage management, signal initialization, screen warm-up, input selection. You don't care; you just want the TV on.
* **Airport check-in counter** for an international flight: one queue, but behind it: bag tagging, security pre-screening, customs, frequent-flyer benefits, seat assignment, pre-clearance, baggage routing.

---

## 3. Bad Code Example — Client Orchestrating the Subsystem Directly

This is what happens when there's no facade and every caller has to drive the subsystem itself.

```ts
// The "subsystem" — many classes, each with a real responsibility
class InventoryService {
  reserveItems(items: Item[]): string { return "reservation-id-123"; }
  releaseItems(reservationId: string) { /* ... */ }
}
class PaymentService {
  charge(userId: string, amount: number): string { return "txn-id-456"; }
  refund(txnId: string) { /* ... */ }
}
class ShippingService {
  schedule(items: Item[], address: string): string { return "tracking-789"; }
}
class EmailService {
  sendOrderConfirmation(userId: string, orderId: string) { /* ... */ }
}
class AnalyticsService {
  recordOrderEvent(userId: string, amount: number) { /* ... */ }
}

// ❌ BAD: every caller manages the dance themselves
class CheckoutController {
  async placeOrder(userId: string, items: Item[], address: string, total: number) {
    const inventory = new InventoryService();
    const payment = new PaymentService();
    const shipping = new ShippingService();
    const email = new EmailService();
    const analytics = new AnalyticsService();

    const reservationId = inventory.reserveItems(items);
    let txnId: string;
    try {
      txnId = payment.charge(userId, total);
    } catch (e) {
      inventory.releaseItems(reservationId);
      throw e;
    }
    const trackingId = shipping.schedule(items, address);
    email.sendOrderConfirmation(userId, "order-id");
    analytics.recordOrderEvent(userId, total);
    return { txnId, trackingId };
  }
}

// And then a totally separate place needs to do the same:
class CartAbandonmentRecovery {
  async finalizeOrder(userId: string, items: Item[], address: string, total: number) {
    const inventory = new InventoryService();
    const payment = new PaymentService();
    // ... the same orchestration, copy-pasted
    const reservationId = inventory.reserveItems(items);
    const txnId = payment.charge(userId, total);
    // forgot to release inventory on failure here. silent bug.
  }
}
```

What's wrong:

1. **Orchestration knowledge is duplicated.** Every caller knows the right sequence: reserve → pay → schedule → notify. Drift between callers is inevitable.
2. **Failure compensation is fragile.** The try/catch that releases inventory if payment fails is in *one* place. The cart-abandonment recovery code forgot it. That's a real production bug class.
3. **Subsystem coupling.** `CheckoutController` knows about five concrete classes. Replace `EmailService` with a queue-based notification service and the controller breaks.
4. **Discovery is impossible.** A new developer asking "how do I place an order?" has to read through the controller to figure it out. There's no canonical "place order" entry point.
5. **Untestable.** The five `new` calls are inline; mocking is a chore.

---

## 4. Good Code Example — Facade in TypeScript

### 4a. The basic Facade

```ts
// ============================================================
// 1) The subsystem — unchanged
// ============================================================
class InventoryService {
  reserveItems(items: Item[]): string { return "reservation-id-123"; }
  releaseItems(reservationId: string) { /* ... */ }
}
class PaymentService {
  charge(userId: string, amount: number): string { return "txn-id-456"; }
  refund(txnId: string) { /* ... */ }
}
class ShippingService {
  schedule(items: Item[], address: string): string { return "tracking-789"; }
}
class EmailService {
  sendOrderConfirmation(userId: string, orderId: string) { /* ... */ }
}
class AnalyticsService {
  recordOrderEvent(userId: string, amount: number) { /* ... */ }
}

// ============================================================
// 2) The Facade — one entry point per use case
// ============================================================
type OrderRequest = { userId: string; items: Item[]; address: string; total: number };
type OrderResult  = { orderId: string; txnId: string; trackingId: string };

class OrderFacade {
  constructor(
    private inventory: InventoryService,
    private payment: PaymentService,
    private shipping: ShippingService,
    private email: EmailService,
    private analytics: AnalyticsService,
  ) {}

  async placeOrder(req: OrderRequest): Promise<OrderResult> {
    const reservationId = this.inventory.reserveItems(req.items);
    let txnId: string;
    try {
      txnId = this.payment.charge(req.userId, req.total);
    } catch (e) {
      this.inventory.releaseItems(reservationId);
      throw e;
    }
    const trackingId = this.shipping.schedule(req.items, req.address);
    const orderId = `order-${Date.now()}`;
    this.email.sendOrderConfirmation(req.userId, orderId);
    this.analytics.recordOrderEvent(req.userId, req.total);
    return { orderId, txnId, trackingId };
  }

  async cancelOrder(orderId: string, txnId: string, reservationId: string) {
    this.payment.refund(txnId);
    this.inventory.releaseItems(reservationId);
    // notification, analytics, etc.
  }
}

// ============================================================
// 3) Clients — depend on the Facade, not the subsystem
// ============================================================
class CheckoutController {
  constructor(private orders: OrderFacade) {}
  async place(req: OrderRequest) { return this.orders.placeOrder(req); }
}

class CartAbandonmentRecovery {
  constructor(private orders: OrderFacade) {}
  async finalize(req: OrderRequest) { return this.orders.placeOrder(req); }
}

// ============================================================
// 4) Composition root
// ============================================================
const facade = new OrderFacade(
  new InventoryService(),
  new PaymentService(),
  new ShippingService(),
  new EmailService(),
  new AnalyticsService(),
);
const checkout = new CheckoutController(facade);
const recovery = new CartAbandonmentRecovery(facade);
```

What this buys:

* **One canonical "place order" sequence**, used by every caller.
* **Failure compensation lives in one place** — the inventory rollback can't be forgotten.
* **Clients depend on the Facade only.** Five subsystem classes are invisible to them.
* **Unit-testable.** Inject mock subsystem classes into the Facade; inject a mock Facade into the controllers.
* **Refactor-friendly.** Replacing `EmailService` with a queue is a Facade-internal change. No client cares.

### 4b. Multiple Facades over the same subsystem

A common evolution: as use cases multiply, split the Facade by purpose. This keeps each Facade small and SRP-clean.

```ts
class OrderCheckoutFacade {
  // placeOrder, calculateShipping, applyCoupon, ...
}

class OrderRefundFacade {
  // refund, partialRefund, returnLabel, restock, ...
}

class OrderReportingFacade {
  // dailyRevenue, topCustomers, fulfillmentMetrics, ...
}
```

All three may use `PaymentService`, `InventoryService`, etc., but each has a different *use-case footprint*. You'd never mix `dailyRevenue()` and `placeOrder()` on the same class — they belong to different audiences (admins vs customers).

### 4c. Facade over a sprawling third-party library

Real example: video processing using `ffmpeg` (which has hundreds of options).

```ts
// The "subsystem" — ffmpeg's full API surface, dozens of utilities
import ffmpeg from "fluent-ffmpeg";

// Facade — exposes the 3 things our app actually does
class VideoFacade {
  async compressForWeb(input: string, output: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(input)
        .videoCodec("libx264")
        .audioCodec("aac")
        .videoBitrate(1500)
        .size("1280x720")
        .format("mp4")
        .on("end", () => resolve())
        .on("error", reject)
        .save(output);
    });
  }

  async extractAudio(input: string, output: string): Promise<void> { /* ... */ }
  async generateThumbnail(input: string, output: string, atSec: number): Promise<void> { /* ... */ }
}
```

Application code says `videoFacade.compressForWeb(...)`. It doesn't care that ffmpeg has 400 flags, that bitrate is in kbps, that the codec name is `libx264` and not `h264`. All that knowledge is encapsulated in the Facade.

If you decide tomorrow to switch from ffmpeg to a cloud service like Mux or Cloudflare Stream, only the Facade changes. The "compress this video" call site is untouched.

### 4d. Facade can sit on top of an Adapter

A real production stack often looks like this:

```ts
// Adapter — translates one library's API to a common shape
class StripeAdapter implements PaymentGateway { ... }

// Facade — orchestrates many gateways, plus inventory, plus emails
class CheckoutFacade {
  constructor(private gateway: PaymentGateway, private inventory: InventoryService, ...) {}
  async checkout(...) { /* uses gateway + inventory + ... */ }
}
```

Layered cleanly: each layer has one job.

---

## 5. Real-world Use Cases

* **jQuery's `$()`** — the original web Facade. One function over `getElementById`, `getElementsByTagName`, event listeners, AJAX, animation. The reason jQuery dominated for a decade: it tamed a hostile API.
* **`axios.get(url, config)`** — Facade over `XMLHttpRequest` and modern `fetch`, plus interceptors, retries, request/response transformation.
* **`fetch()` itself** — Facade over the underlying networking stack, cookies, redirects, body encoding.
* **Stripe's `stripe.charges.create({ ... })`** — Facade over HTTP, idempotency keys, request signing, retry logic, error parsing. You see one method; under it are 8 internal subsystems.
* **AWS SDK high-level clients** — `DynamoDBDocument.from(client)` is a Facade over the lower-level `DynamoDB` client that takes care of marshaling/unmarshaling.
* **`React.createRoot(node).render(<App/>)`** — Facade over the entire reconciliation engine, fiber, scheduler, hydration, batching.
* **Service classes in Spring / NestJS** — `UserService.createUser(input)` is almost always a Facade hiding repository writes, password hashing, email confirmation, audit logging, event publication.
* **Express's `res.send(...)`** — Facade hiding header negotiation, status codes, content-type inference, encoding, compression.
* **`mongoose.Schema(...)` + `Model.create(...)`** — Facade over MongoDB driver, connection pool, validation, hooks.
* **`localStorage.setItem` / `getItem`** — Facade over the structured storage subsystem in browsers.
* **Higher-level testing tools (Cypress, Playwright)** — Facades over the WebDriver / DevTools protocol.
* **`useEffect`, `useState`** — Hook APIs are Facades over React's internal scheduler and component lifecycle.
* **CDK / Terraform high-level constructs** — `new Bucket(this, "MyBucket")` is a Facade over the CloudFormation/Terraform primitives needed to actually provision a bucket with sensible defaults.

In your day-to-day frontend work, *almost every "service" or "manager" or "client" class you import is a Facade*, even if no one labels it that way.

---

## 6. Interview Questions

### Q1. Facade vs Adapter vs Mediator — what's the difference?

**Answer:** All three are about taming complexity, but they target different shapes.

* **Adapter** — *one* class, *different interface*. You wrap a single existing class and re-expose it under a contract your code expects. The wrapping is 1:1.
* **Facade** — *many* classes, *new simpler interface*. You wrap a whole subsystem and expose a small, intentional API. The wrapping is 1:N.
* **Mediator** — *many peers* that need to coordinate. Mediator routes messages between them so they don't talk to each other directly. The relationship is N:N flowing through a central hub.

A useful test: if you're translating between APIs (one ↔ one), it's Adapter. If you're hiding a tangle of classes behind a friendly entry point, it's Facade. If multiple peers need to react to each other (chat room, dialog widgets), that's Mediator.

You'll often layer them: an Adapter normalizes a third-party SDK, a Facade orchestrates several Adapters, a Mediator coordinates multiple Facades for a workflow.

---

### Q2. When does a Facade become a God Class? How do you prevent it?

**Answer:** A facade has drifted into god-class territory when:

1. It has dozens of unrelated methods (`placeOrder`, `runDailyReport`, `migrateUser`, `exportToCSV`, ...).
2. Adding "any new behavior" defaults to "put it on the Facade."
3. The Facade depends on every other class in the codebase.
4. Methods don't share callers, or the audiences are wildly different (admin tools and customer flows on the same class).

Prevention strategies:

1. **Split by use case, not by subsystem.** Instead of one `OrderFacade`, you might have `OrderCheckoutFacade`, `OrderRefundFacade`, `OrderReportingFacade`. Each Facade serves a specific *audience* (customer-facing, support-tool-facing, admin-dashboard-facing). They can share underlying services, but not one bloated class.
2. **Cap the surface.** A Facade with more than ~10 public methods is suspect. If the use cases are genuinely different, they should be different facades.
3. **Apply ISP (Interface Segregation).** If two callers each use a non-overlapping subset of methods, that's a sign your Facade should be two interfaces.
4. **Watch for "the place I always end up putting things."** That phrase is a smell. If new behavior keeps landing on one class, that class is becoming a god.

The honest framing: Facade is a *helpful coordinator* for one well-defined use case. The moment it tries to be the helpful coordinator for everything, it's a god class.

---

### Q3. Doesn't a Facade violate Single Responsibility, since it touches many classes?

**Answer:** No — and this is a great question because the answer requires a precise reading of SRP.

SRP says a class should have *one reason to change* — one *axis of variation*. A Facade touches many classes, but its *responsibility* is "expose use case X to clients." It changes when use case X changes. The classes underneath have their own responsibilities; the Facade's responsibility is *orchestration of them for use case X*.

The test is "if I change Y, does this class change?":

* If I change Stripe's API → `StripeAdapter` changes (its job).
* If I add a new email type → `EmailService` changes (its job).
* If I change the *checkout workflow* (now it requires fraud screening before payment) → `OrderCheckoutFacade` changes (its job).

So the Facade has a single, specific responsibility: orchestrate the pieces for one use case. Multiple subsystem dependencies don't violate SRP, as long as the Facade serves *one workflow*.

What *would* violate SRP: a Facade that does both checkout and refund, because those are two different workflows that change for two different reasons. That's where you split into multiple Facades.

---

### Q4. Walk me through how you'd use Facade for a video upload feature.

**Answer:** Imagine the operation: user uploads a raw video; we need to compress it, generate a thumbnail, store it in S3, store metadata in the DB, transcribe the audio, send a notification when ready.

The subsystem:

* `VideoCompressor` (wraps ffmpeg)
* `ThumbnailGenerator` (wraps ffmpeg's frame extraction)
* `StorageClient` (wraps S3)
* `TranscriptionService` (wraps a third-party speech-to-text API)
* `MetadataRepository` (wraps the DB)
* `NotificationService` (wraps email/push/Slack)

The Facade:

```ts
type UploadRequest = { userId: string; rawFile: Buffer; filename: string };
type UploadResult  = { videoId: string; previewUrl: string; thumbUrl: string };

class VideoUploadFacade {
  constructor(
    private compressor: VideoCompressor,
    private thumbnails: ThumbnailGenerator,
    private storage: StorageClient,
    private transcription: TranscriptionService,
    private metadata: MetadataRepository,
    private notifications: NotificationService,
  ) {}

  async upload(req: UploadRequest): Promise<UploadResult> {
    const videoId = uuid();
    const compressed = await this.compressor.compressForWeb(req.rawFile);
    const thumb = await this.thumbnails.frameAt(compressed, 1.0);
    const [videoUrl, thumbUrl] = await Promise.all([
      this.storage.upload(`videos/${videoId}.mp4`, compressed),
      this.storage.upload(`thumbs/${videoId}.jpg`, thumb),
    ]);
    await this.metadata.save({ videoId, userId: req.userId, videoUrl, thumbUrl, status: "uploaded" });
    // fire-and-forget, eventually-consistent step
    this.transcription.requestAsync(videoUrl).then(text =>
      this.metadata.attachTranscript(videoId, text),
    );
    await this.notifications.sendVideoReady(req.userId, videoId);
    return { videoId, previewUrl: videoUrl, thumbUrl };
  }
}
```

What the interviewer is checking:

1. **Single use case.** The Facade does *upload*. Editing, deleting, sharing — different facades.
2. **Orchestration is the job.** No business logic is invented in the Facade — it sequences calls.
3. **Async is handled thoughtfully.** Transcription is fire-and-forget; we don't make the user wait for it.
4. **Errors and compensation.** They'll likely ask about partial failures. The mature answer: this is where you start thinking about Saga / compensating transactions — pick one (delete from S3 if metadata save fails, etc.) and explain it. Show that you know simple try/catch is insufficient for distributed steps.
5. **Replaceability.** "If we move from ffmpeg-on-server to AWS MediaConvert, only `VideoCompressor` and possibly the Facade need changing — the upload route is untouched."

---

### Q5. How is Facade different from "just having a function"?

**Answer:** Mechanically, they're similar — a Facade is often a class with a small handful of methods that orchestrate other things, and you could implement the same with plain functions. But there are real differences in practice:

1. **State and dependencies.** A Facade holds its dependencies as fields (injected once). Plain functions usually need them passed in as arguments every call, or pulled from globals (bad). The Facade's class shape gives you natural DI scoping.
2. **Polymorphism and substitutability.** Because a Facade is a class implementing an interface, you can swap implementations — `MockOrderFacade` in tests, `LegacyOrderFacade` for old customers. You can't easily polymorphically swap a function unless you abstract over it.
3. **Group of related operations.** A Facade collects related methods (`placeOrder`, `cancelOrder`, `refund`) under one cohesive name. Plain functions scattered in a file lose the discoverability — "what can I do with orders?" is one autocomplete on the facade.
4. **Future extension.** Cross-cutting concerns (logging every facade method, caching, retries) are easier to apply to a class via Decorator pattern than to a bag of functions.

That said, for *simple* facades — one or two methods, no state — a plain function is fine. Don't add a class for ceremony alone. The class shape earns its keep when you have multiple related operations, shared dependencies, or substitutability needs.

---

## TL;DR Cheat Sheet

```
Facade: a single, simplified entry point over a complex subsystem.

Recipe:
  1. Identify the use case (e.g., "place an order")
  2. Inject the subsystem services as constructor dependencies
  3. Expose one (or a few) methods that orchestrate the right sequence
  4. Keep business logic inside the subsystem, not on the Facade

Use when:
  - common operations require coordinating several classes
  - clients should not depend on the entire subsystem
  - you want a small, intentional API over a sprawling library
  - third-party SDKs are too low-level for everyday use

Don't use when:
  - the subsystem is already simple — Facade adds noise
  - the "Facade" would carry meaningful business logic — that's a service
  - one Facade tries to serve every use case → god class

vs Adapter:  Facade is many-to-one; Adapter is one-to-one.
vs Decorator: Facade introduces a new interface; Decorator preserves it.
vs Mediator:  Mediator routes peer-to-peer; Facade orchestrates one direction.

Watch for: god-class drift. Split by use case (CheckoutFacade, RefundFacade,
           ReportingFacade) when one facade gets too broad.

SRP: A Facade has ONE responsibility — orchestrating one use case. Multiple
     dependencies are not an SRP violation.

Real-world: jQuery's $(), axios, Stripe SDK, AWS high-level clients,
            React.createRoot, Express's res.send, NestJS service classes.
```
