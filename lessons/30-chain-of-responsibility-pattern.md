# 30 — Chain of Responsibility Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, ubiquitous in real code

---

## 1. Concept / Theory

**Chain of Responsibility (CoR)** decouples a sender from receivers by passing a request along a **chain of handlers**. Each handler either:

* **Processes** the request and stops the chain, or
* **Passes** the request to the next handler, possibly after some pre-processing.

The sender doesn't know which handler will end up doing the work. New handlers can be inserted, removed, or reordered without changing the sender.

```
   ┌────────┐
   │ Sender │
   └───┬────┘
       │ request
       ▼
   ┌─────────────┐ ──passes──▶ ┌─────────────┐ ──passes──▶ ┌─────────────┐
   │  Handler1   │              │  Handler2   │              │  Handler3   │
   │ canHandle?  │              │ canHandle?  │              │ canHandle?  │
   │ handle | →  │              │ handle | →  │              │ handle | →  │
   └─────────────┘              └─────────────┘              └─────────────┘
```

The pattern shows up wherever you find one of these:

* **Approval workflows** — manager approves up to ₹10k, director up to ₹1L, CEO above that.
* **HTTP middleware** — auth → logging → rate limit → body parse → handler.
* **Logger filters** — only INFO and above to console; only ERROR to Sentry; everything to file.
* **ATM cash dispense** — try ₹2000 notes first, then ₹500, then ₹100, then ₹50.
* **Event bubbling** — DOM events traverse from the target up to `<html>`; any ancestor can `stopPropagation()`.
* **Customer support tiers** — Tier 1 handles common stuff, escalates the hard stuff up the chain.
* **Discount eligibility** — try every promo rule in order; the first applicable one wins.
* **Validation pipelines** — required → format → uniqueness → external API. Stop on first failure.

### Two flavors of the pattern

**Pure CoR** — exactly **one** handler processes the request, and the chain stops there. Early termination. Examples: approval workflow, ATM dispenser, event bubbling with `stopPropagation`.

**Pipeline / processing chain** — *every* handler processes (or transforms) the request, and the chain continues to completion. Sometimes called the **"middleware" form**. Examples: Express middleware, Webpack loaders, axios interceptors.

Both are CoR; the difference is whether handlers stop the chain or always forward. Real systems mix both: an Express middleware can either call `next()` (continue) or end the response (stop the chain).

### Why it matters

Without CoR, the dispatch logic lives in one place — a giant `if`/`switch` deciding who handles what. Adding a new handler edits that switch. CoR turns each handler into its own object that knows its own responsibilities and how to forward what it can't handle. New handler? New file. Removed handler? Drop a node from the chain.

### CoR vs Decorator (interview question waiting to happen)

Both wrap-and-forward. The difference is intent + termination:

* **Decorator** — same interface, *adds behavior alongside* the wrapped call. Always invokes the inner thing (or chooses to). Each layer is *additive*; the operation eventually reaches the base.
* **Chain of Responsibility** — handlers can *short-circuit* and stop the request from reaching later handlers. The chain is *selective*; some requests stop early, others traverse the whole chain.

In practice, modern middleware blurs the line. An Express middleware that just adds a header is Decorator-ish; one that returns 401 on bad auth is CoR-ish (it stops the chain). The shape is the same; the *intent* of the handler decides which pattern label fits.

---

## 2. Real-life Analogy

A **customer support call**. You dial in. Tier 1 handles password resets. Anything harder — they transfer you to Tier 2. Tier 2 handles billing issues. Anything *they* can't solve — Tier 3 (engineering). At each tier, the handler decides: "Can I solve this? If yes, solve. If no, pass it on."

You (the sender) don't know which tier will end up helping. That's the point — the chain figures it out.

Other clean analogies:

* **Approval workflow.** Buying a $500 item: your manager approves. $50,000: director. $5M: board. The request walks up until someone has authority.
* **Email filters.** Spam filter → important sender filter → category labeler → inbox. Each filter inspects the email and either acts or forwards.
* **A bouncer at a multi-floor club.** The first bouncer checks ID. If under 21, denied. Otherwise pass to the second who checks the dress code. Then to the third who collects the cover charge.
* **Recursive doctors' specialists.** GP → specialist → sub-specialist. Each one handles what they can and refers up.

---

## 3. Bad Code Example — One Big Switch

What approval logic looks like without CoR.

```ts
// ❌ BAD: every approval rule centralized in one method
class ApprovalService {
  approve(req: { amount: number; requesterId: string }): { approver: string } | "rejected" {
    if (req.amount <= 1_000) {
      // automatic
      return { approver: "auto" };
    } else if (req.amount <= 10_000) {
      // manager approval
      const ok = managerCanApprove(req);
      return ok ? { approver: "manager" } : "rejected";
    } else if (req.amount <= 100_000) {
      // director approval
      const ok = directorCanApprove(req);
      return ok ? { approver: "director" } : "rejected";
    } else if (req.amount <= 1_000_000) {
      // VP approval
      const ok = vpCanApprove(req);
      return ok ? { approver: "vp" } : "rejected";
    } else {
      // CEO approval
      const ok = ceoCanApprove(req);
      return ok ? { approver: "ceo" } : "rejected";
    }
  }
}
```

What's wrong:

1. **All authority levels live in one method.** Adding a new tier (e.g., "Region Head") edits this method.
2. **Order is hardcoded.** Want to swap manager and team-lead order? Edit the switch.
3. **Hard to test in isolation.** Each tier's logic is mixed with the routing logic.
4. **Reuse is impossible.** What if "fraud detection" should also check approvals? Copy the method.
5. **Configuration is impossible.** You can't read tiers from a database; they're hard-coded in code.

CoR gives each tier its own class, lets you build the chain by configuration, and makes the dispatch entirely declarative.

---

## 4. Good Code Example — CoR in TypeScript

### 4a. Approval workflow (pure CoR — one handler wins)

```ts
// ============================================================
// 1) Handler interface
// ============================================================
type ApprovalRequest = { amount: number; requesterId: string };
type ApprovalResult  = { approver: string } | "rejected";

interface Approver {
  setNext(next: Approver): Approver;
  handle(req: ApprovalRequest): ApprovalResult;
}

// ============================================================
// 2) Base class — handles forwarding boilerplate
// ============================================================
abstract class BaseApprover implements Approver {
  protected next?: Approver;

  setNext(next: Approver): Approver {
    this.next = next;
    return next;            // chainable: a.setNext(b).setNext(c)
  }

  handle(req: ApprovalRequest): ApprovalResult {
    if (this.next) return this.next.handle(req);
    return "rejected";       // end of chain
  }
}

// ============================================================
// 3) Concrete handlers — each owns one tier
// ============================================================
class AutoApprover extends BaseApprover {
  handle(req: ApprovalRequest): ApprovalResult {
    if (req.amount <= 1_000) return { approver: "auto" };
    return super.handle(req);
  }
}

class ManagerApprover extends BaseApprover {
  handle(req: ApprovalRequest): ApprovalResult {
    if (req.amount <= 10_000) return { approver: "manager" };
    return super.handle(req);
  }
}

class DirectorApprover extends BaseApprover {
  handle(req: ApprovalRequest): ApprovalResult {
    if (req.amount <= 100_000) return { approver: "director" };
    return super.handle(req);
  }
}

class CeoApprover extends BaseApprover {
  handle(req: ApprovalRequest): ApprovalResult {
    if (req.amount <= 1_000_000_000) return { approver: "ceo" };  // CEO can approve anything realistic
    return super.handle(req);
  }
}

// ============================================================
// 4) Build the chain
// ============================================================
const auto     = new AutoApprover();
const manager  = new ManagerApprover();
const director = new DirectorApprover();
const ceo      = new CeoApprover();

auto.setNext(manager).setNext(director).setNext(ceo);

// ============================================================
// 5) Use it
// ============================================================
console.log(auto.handle({ amount: 500,     requesterId: "u1" })); // { approver: "auto" }
console.log(auto.handle({ amount: 5_000,   requesterId: "u1" })); // { approver: "manager" }
console.log(auto.handle({ amount: 50_000,  requesterId: "u1" })); // { approver: "director" }
console.log(auto.handle({ amount: 500_000, requesterId: "u1" })); // { approver: "ceo" }
```

What changed from the bad version:

* **Each tier is its own class.** New tier? New file. Existing tiers untouched.
* **Routing is the chain itself**, not a switch. Reorder with `setNext` calls.
* **Dispatch is declarative.** Read the chain top to bottom; no hidden conditionals.
* **Testable in isolation.** Each Approver tested with stubbed `next`.
* **Configurable.** You could literally read approval tiers from a database and build the chain at startup.

### 4b. HTTP middleware (pipeline-form CoR)

This is the form Express, Koa, Fastify, NestJS, and Connect all use. Every middleware processes the request and either calls `next()` (continue) or terminates (stop the chain).

```ts
type Req  = { url: string; headers: Record<string, string>; user?: { id: string } };
type Res  = { status: number; body?: unknown };
type Next = () => Promise<void>;

type Middleware = (req: Req, res: Res, next: Next) => Promise<void>;

// build a chain runner
function compose(middlewares: Middleware[]): Middleware {
  return async (req, res) => {
    let i = -1;
    const dispatch = async (idx: number): Promise<void> => {
      if (idx <= i) throw new Error("next() called twice");
      i = idx;
      const fn = middlewares[idx];
      if (!fn) return;
      await fn(req, res, () => dispatch(idx + 1));
    };
    return dispatch(0);
  };
}

// concrete middlewares
const loggingMiddleware: Middleware = async (req, _, next) => {
  const t0 = Date.now();
  console.log(`→ ${req.url}`);
  await next();
  console.log(`← ${req.url} ${Date.now() - t0}ms`);
};

const authMiddleware: Middleware = async (req, res, next) => {
  if (!req.headers["authorization"]) {
    res.status = 401;
    res.body = { error: "missing auth" };
    return;                          // STOP the chain
  }
  req.user = { id: "decoded-from-token" };
  await next();
};

const rateLimitMiddleware: Middleware = async (req, res, next) => {
  if (await isOverLimit(req.user!.id)) {
    res.status = 429;
    return;                          // STOP the chain
  }
  await next();
};

const handler: Middleware = async (req, res, _next) => {
  res.status = 200;
  res.body = { hello: req.user!.id };
};

const app = compose([loggingMiddleware, authMiddleware, rateLimitMiddleware, handler]);

await app({ url: "/me", headers: { authorization: "Bearer xyz" } } as Req, { status: 0 } as Res);
```

Same shape as Express — a stack of `(req, res, next)` functions, each deciding whether to call `next()` or end the response. This is CoR in pipeline form.

The interesting feature: **logging-around-handler** works because `next()` is awaited. Anything before `await next()` runs *down* the chain; anything after runs *up* on the way back. That's how you measure response time across the whole pipeline in one middleware.

### 4c. Logger with level filters

```ts
type LogLevel = "debug" | "info" | "warn" | "error";

interface LogHandler {
  setNext(next: LogHandler): LogHandler;
  log(level: LogLevel, msg: string): void;
}

class BaseLogHandler implements LogHandler {
  protected next?: LogHandler;
  setNext(n: LogHandler) { this.next = n; return n; }
  log(level: LogLevel, msg: string) { this.next?.log(level, msg); }
}

const order: LogLevel[] = ["debug", "info", "warn", "error"];
const ge = (a: LogLevel, b: LogLevel) => order.indexOf(a) >= order.indexOf(b);

class ConsoleLogHandler extends BaseLogHandler {
  log(level: LogLevel, msg: string) {
    if (ge(level, "info")) console.log(`[${level}] ${msg}`);
    super.log(level, msg);   // FORWARD — pipeline form, every handler may handle
  }
}

class FileLogHandler extends BaseLogHandler {
  log(level: LogLevel, msg: string) {
    appendToFile(`[${level}] ${msg}\n`);
    super.log(level, msg);
  }
}

class SentryLogHandler extends BaseLogHandler {
  log(level: LogLevel, msg: string) {
    if (ge(level, "error")) sendToSentry(msg);
    super.log(level, msg);
  }
}

const logger = new ConsoleLogHandler();
logger.setNext(new FileLogHandler()).setNext(new SentryLogHandler());

logger.log("info", "user signed in");
// console: [info] user signed in
// file:    [info] user signed in
// sentry:  (skipped — info < error)

logger.log("error", "DB unreachable");
// console: [error] DB unreachable
// file:    [error] DB unreachable
// sentry:  sent
```

This is pipeline-form CoR: every handler runs, each decides whether to *act* on the message based on level. Same code shape, no `if (level === ...)` switch in the dispatcher.

### 4d. Validation chain

Validation is one of the cleanest CoR examples — first failure wins.

```ts
type ValidationResult = { ok: true } | { ok: false; reason: string };

interface Validator { validate(input: unknown): ValidationResult; }

const required: Validator = { validate: v => v != null ? { ok: true } : { ok: false, reason: "required" } };
const isEmail:  Validator = { validate: v => typeof v === "string" && /@/.test(v) ? { ok: true } : { ok: false, reason: "format" } };
const isUnique: Validator = { validate: async (v) => /* ... */ ({ ok: true }) } as any;

function chain(...validators: Validator[]): Validator {
  return {
    validate(input) {
      for (const v of validators) {
        const r = v.validate(input);
        if (!r.ok) return r;     // stop on first failure (pure CoR)
      }
      return { ok: true };
    },
  };
}

const validator = chain(required, isEmail, isUnique);
```

Yup, Zod, and Joi are essentially built on top of this idea (with much more sugar).

---

## 5. Real-world Use Cases

* **Express / Koa / Fastify / Connect middleware** — `app.use(...)` builds a pipeline-form CoR. Each middleware either calls `next()` or ends the response.
* **NestJS interceptors / guards / pipes** — multiple chains of CoR, one per concern (auth, transformation, validation).
* **Servlet filter chains in Java** — same pattern, OG version.
* **Spring Security filter chain** — auth, CSRF, session, headers — CoR all the way down.
* **DOM event bubbling** — events propagate from target up to root; any ancestor can call `stopPropagation()`. Pure CoR with optional capture phase before.
* **React error boundaries** — errors bubble up the component tree; the first ancestor with `componentDidCatch` (or `useErrorBoundary`) handles them.
* **axios / fetch interceptors** — pre-request and pre-response handlers chained.
* **Redux middleware** — `applyMiddleware(thunk, logger, sagas)` is pipeline CoR around `dispatch`.
* **Webpack loaders** — file → loader1 → loader2 → ... → bundle. Each loader transforms the source, then forwards.
* **Babel plugins** — same shape: each plugin is a pass over the AST.
* **Logger frameworks** — Winston / Pino transports are CoR; each transport decides what to do.
* **Validation libraries** — Yup, Zod, Joi, class-validator — each rule is a step in a chain.
* **HTTP routing** — many frameworks try routes in order; the first match handles.
* **Pricing / discount eligibility** — try each rule in order; first applicable rule wins.
* **Authentication strategies in Passport.js** — try Local, then OAuth, then JWT, etc.
* **Compression / encoding negotiation** — content-encoding pipeline (gzip → identity).
* **Build pipelines** — Vite, Rollup, esbuild plugins — pipeline CoR over file transformations.
* **Gradle / Maven build phases** — each phase is a handler.
* **GraphQL middleware (graphql-shield, etc.)** — auth and authorization gates on resolvers.
* **Rate limiters with multiple tiers** — try the IP limit, then user limit, then endpoint limit.

When you see `app.use(...)` or `interceptors.request.use(...)` or `pipe(a, b, c)` in any framework's API, you're configuring a CoR.

---

## 6. Interview Questions

### Q1. What's the difference between Chain of Responsibility and Decorator?

**Answer:** Both involve a chain of objects sharing the same interface, where each layer wraps and forwards. The difference is **termination semantics** and **intent**.

* **Decorator** — every layer *augments* the call. The base operation always (or almost always) reaches the bottom. Each layer is additive: logging adds log lines, caching adds memoization, retries add resilience.
* **Chain of Responsibility** — handlers can *short-circuit*. A handler may decide to handle the request fully and stop the chain, never reaching later handlers.

Mechanical test: in your wrapper's body, do you *always* call `next()` (or the inner method), or do you *sometimes* skip it because you've handled the request? Always-forward → Decorator. Sometimes-stop → CoR.

In practice they overlap. Express middleware that just adds a `req.startTime` is Decorator-flavored; one that returns 401 is CoR-flavored. The shape is the same.

A useful framing: **Decorator answers "what extra should happen?"; CoR answers "who should handle this?"**

---

### Q2. Walk me through implementing an HTTP middleware system.

**Answer:** (See section 4b for full code; here's the walkthrough.)

I'd model:

1. **`Middleware`** as a function `(req, res, next) => Promise<void>`. Each middleware can read/modify the request and response, and decide whether to call `next()`.
2. A **composer** that takes an array of middlewares and returns a single composed function. The composer maintains an index and dispatches in order.
3. Each middleware can:
   * Run code, then call `next()` — proceeds down the chain.
   * Run code, *not* call `next()` — terminates the chain (auth failure, rate limit hit).
   * Wrap `next()` with `try`/`catch` or timing — that's how you implement around-handler logging.

Things the interviewer wants to hear:

1. **`await next()` enables both downward and upward processing.** Code before `await next()` runs on the way *down* the chain; code after runs on the way *up*. That's how you measure response times.
2. **Termination is opt-in.** Not calling `next()` stops the chain. That's the CoR characteristic.
3. **Error handling.** A throw at any step propagates up unless caught. Express has special "error middlewares" with `(err, req, res, next)` signature. NestJS has filters.
4. **Order matters.** Auth before rate limit. Logging outside everything. Body parser before handlers. The chain order is the dispatch order.
5. **Idempotency of `next()`.** Calling `next()` twice is a bug in production middlewares — runtime check or just discipline.

Senior signal: explicitly mention the upward-traversal property and how it makes timing/transactions/error-handling natural in middleware form.

---

### Q3. Implement an approval workflow where amount thresholds determine the approver.

**Answer:** (See section 4a for full code.) Key points:

1. **Each tier is a class** with one rule: "if I can handle it, do; else delegate to next."
2. **Build the chain at config time** with `setNext()`.
3. **The chain itself is the routing logic**; no switches anywhere.
4. **Adding a Region-Head tier** is a new class + one extra `setNext()` call. Existing tiers untouched.

Senior-signal extensions to mention:

* **Configuration-driven chain.** Read tiers and limits from a database; build the chain at startup. Different orgs can have different chains without code changes.
* **Logging the path.** Wrap each handler in a logging Decorator so audit logs say "request 123 went through Auto → Manager → Director."
* **Async chain.** Approvers might require human input — the chain shouldn't block. Switch to async messaging: each step posts a message and waits for response. Now approvals can take days; the chain is durable.
* **Composable rules.** What if approval depends on amount *and* department *and* requester role? Multiple chains, or one chain whose handlers each check multiple conditions. Keep each handler focused on one rule for readability.

---

### Q4. What's the difference between pure CoR and pipeline-form CoR?

**Answer:**

* **Pure CoR** — exactly *one* handler in the chain processes the request, then it stops. Examples: approval workflow, ATM dispense (first denomination that fits), event with `stopPropagation`, exception handlers (catch and end).
* **Pipeline form** (also called "process chain" or "middleware") — *every* handler in the chain processes (or transforms) the request, and the chain runs to completion. Examples: Express middleware that doesn't terminate, Webpack loaders, log-to-multiple-sinks, axios request interceptors.

Both are CoR — the structural shape is identical. The difference is the handler's semantics: do they stop the chain or always forward?

Real systems mix both. Express middleware can either call `next()` (continue) or end the response (stop). The same chain runner supports both behaviors; the choice is up to each handler.

The naming is fluid. The GoF book describes the "stop on first handler" form as canonical CoR; modern usage stretches the name to cover pipelines too. In interviews, name both flavors and identify which one the use case calls for.

---

### Q5. When is CoR overkill?

**Answer:** A few situations where reaching for CoR adds friction without payoff:

1. **The number of handlers is small and stable.** Two tiers? Just write an `if`. CoR pays off when there are many handlers, the order matters, and new ones get added or removed.
2. **The dispatch logic is genuinely centralized and unlikely to change.** If "amount > X → CEO" is a hard business rule that *must* be in one place for governance, a single method might be better than a chain that could be misconfigured.
3. **All handlers always run.** That's not CoR — that's "for each transformer in the list, apply it." A simple `array.reduce` is clearer than a chain of objects.
4. **Order is an antipattern.** If you find yourself adjusting chain order to fix bugs, the chain is too coupled. Each handler should be order-independent (within reason). When order matters deeply (auth before everything else), encode that as a rule, not as a fragile sequence.
5. **Hot paths.** Each chain step adds an indirect call. In tight loops, an inlined switch can be faster. Profile before adding indirection.

The honest framing: CoR is the right shape for *extensible dispatch* — when handlers will keep being added and the order will keep being tweaked. It's overkill when the dispatch is already simple and stable.

---

## TL;DR Cheat Sheet

```
Chain of Responsibility: pass a request along a chain of handlers; each
                          handler either processes or forwards.

Two flavors:
  - Pure CoR: first match wins, chain stops (approvals, ATM, events)
  - Pipeline: every handler processes, chain runs to completion (middleware)

Recipe:
  1. Handler interface — handle(req) plus a way to set next
  2. Concrete handlers — each owns one rule, decides handle vs forward
  3. Build the chain by linking handlers (setNext or compose([...]))
  4. Sender calls the chain head; doesn't know who actually handles

Use when:
  - multiple handlers could process a request, but only one (or all in
    sequence) should
  - you want to add/remove/reorder handlers without touching dispatch logic
  - dispatch is currently a giant switch/if-else

Don't use when:
  - 2-3 stable handlers — switch is simpler
  - all handlers always run regardless — use array.reduce
  - tight inner loops — indirection cost matters

vs Decorator:
  - Decorator always forwards; CoR may stop the chain
  - Decorator answers "what extra should happen?"
  - CoR answers "who should handle this?"

vs Composite:
  - Composite is a tree; CoR is a linear chain
  - Composite asks for aggregation; CoR asks for delegation

Two key features in pipeline form:
  - await next() — code before runs DOWN the chain, code after runs UP
  - termination — not calling next() stops processing

Real-world: Express/Koa/Fastify, axios interceptors, Redux middleware,
            Servlet filters, Spring Security, DOM event bubbling, React
            error boundaries, Webpack loaders, Babel plugins, NestJS
            interceptors/guards/pipes, logger transports, validation
            chains, approval workflows, Passport.js strategies.

Interview gold: build approval workflow OR HTTP middleware. Mention
                upward-traversal in pipeline form. Distinguish pure
                CoR from pipeline form. Compare cleanly to Decorator.
```
