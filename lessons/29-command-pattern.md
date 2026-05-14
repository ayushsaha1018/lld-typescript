# 29 — Command Pattern

> Phase 4 — Design Patterns → Behavioral
> Pattern type: Behavioral
> Difficulty: Easy concept, ridiculously useful

---

## 1. Concept / Theory

**Command** turns a *request* into an *object*. Instead of calling `receiver.doX(args)` directly, you wrap the call (receiver + method + args) in a Command object that has an `execute()` method. The Command can then be:

* **Queued** — stored in a list and run later, possibly on a different thread or worker.
* **Logged** — persisted for audit / replay.
* **Undone** — paired with an `undo()` method, you can reverse the operation.
* **Composed** — multiple Commands wrapped into a "macro" via Composite.
* **Decoupled** — the *invoker* (a button, a key handler, a job runner) doesn't need to know what the Command does.

The pattern shows up wherever you find one of these:

* "I want undo/redo."
* "I want to queue work to run later or remotely."
* "I want users to be able to bind keys to actions."
* "I want to record and replay user input (macros)."
* "I want every action that mutates state to be logged or auditable."

```
                    ┌──────────────┐
                    │   Client     │  builds commands and binds them to receivers
                    └──────┬───────┘
                           │ creates
                           ▼
                    ┌──────────────┐                ┌─────────────┐
                    │   Command    │ ──── targets ─▶│  Receiver   │
                    │ + execute()  │                │  (the doer) │
                    │ + undo()     │                └─────────────┘
                    └──────┬───────┘
                           │ run by
                           ▼
                    ┌──────────────┐
                    │   Invoker    │  triggers execute()
                    │ (button,     │  doesn't know what the command does
                    │  job runner) │
                    └──────────────┘
```

### Five participants (memorize for interviews)

1. **Receiver** — the object that actually does the work (`Document`, `Light`, `Database`).
2. **Command** — interface with `execute()` and (often) `undo()`.
3. **ConcreteCommand** — wraps a specific receiver call (`InsertTextCommand`, `TurnOnLightCommand`).
4. **Invoker** — triggers `execute()` (`Button`, `KeyHandler`, `JobQueue`). Doesn't know what the command does.
5. **Client** — wires everything together: creates commands, binds them to receivers, hands them to invokers.

The decoupling is the magic: the *Invoker* (a generic button) and the *Receiver* (a specific document) don't know about each other. The Command is the bridge.

### The TypeScript twist

In Java, a Command is typically a class. In JS/TS, **a Command is often a closure** — a function that captures the receiver and arguments and returns a callable. Both are valid; we'll show both.

The class form earns its keep when you need:

* `undo()` paired with `execute()` — easier with two methods on one object than two functions.
* Serialization (persisting commands to disk / a queue / a Redux action log).
* Polymorphism (commands stored in a heterogeneous list and run uniformly).

Function-only commands are fine for fire-and-forget operations like generic button handlers.

### Command vs Strategy — the inevitable interview question

Both encapsulate behavior in objects. The intent differs:

* **Strategy** — *how* an algorithm runs. The Context delegates a varying *step* to a strategy. Strategies are usually long-lived and used for many calls.
* **Command** — *what* operation to run. The Command is the *whole* request: a specific receiver + a specific method + specific args. Commands are usually short-lived: created, executed (maybe queued), discarded.

Mechanical test: does the object encapsulate *one specific request* (Command) or *one of several algorithms* (Strategy)?

---

## 2. Real-life Analogy

A **restaurant order ticket**. You don't walk into the kitchen and tell the chef directly what to cook. You give your order to a waiter; the waiter writes a ticket; the ticket is queued at the kitchen; the chef picks tickets in order and cooks. If you cancel before the chef starts, the ticket is pulled. If something's wrong, the ticket is the auditable record of what was ordered.

In the analogy:

* You = Client.
* Waiter = Invoker.
* Ticket = Command.
* Chef = Receiver.
* The kitchen queue = a Command queue.

Other clean analogies:

* **TV remote.** Each button is bound to a command. Pressing "volume up" doesn't mean the button "knows" how the TV's audio circuits work — it dispatches a command.
* **Light switch.** Same thing — the switch holds a generic command; the command knows the lamp.
* **Postal mail.** A letter is a command — receiver address, action ("read this"), payload. The post office is the Invoker; you're the Client.

---

## 3. Bad Code Example — Direct Method Calls Everywhere

This is what code looks like before you introduce Command. Buttons hard-code receiver calls; undo is impossible because there's no record of *what was done*.

```ts
// ❌ BAD: every UI element knows about every receiver
class Document {
  private content = "";
  insertText(s: string) { this.content += s; }
  delete(n: number)     { this.content = this.content.slice(0, -n); }
  print()               { console.log(this.content); }
}

class Toolbar {
  constructor(private doc: Document) {}

  onBoldButtonClick()  { /* directly mutate the doc */ this.doc.insertText("**bold**"); }
  onItalicButtonClick(){ this.doc.insertText("*italic*"); }
  onPrintButtonClick() { this.doc.print(); }
}

// Want undo? Now you have to track what each button did, manually.
// Want to rebind "Bold" to a keyboard shortcut? Copy the body to the key handler.
// Want a job queue? You can't — operations aren't first-class objects.
```

What's wrong:

1. **Toolbar tightly coupled to Document.** Switching to a different receiver type means rewriting the Toolbar.
2. **No undo.** There's no record of what was done; the document only holds the *result*. Reversing requires writing inverse logic by hand for every button.
3. **No queueing.** Operations execute synchronously, inline. Can't defer, batch, or run them remotely.
4. **No reuse.** A keyboard shortcut for "Bold" duplicates the toolbar button's body. So does a menu item. Three copies of the same call.
5. **No logging.** Auditing what the user did is impossible — the document doesn't remember its history.

---

## 4. Good Code Example — Command in TypeScript

### 4a. Text editor with undo/redo (the canonical example)

```ts
// ============================================================
// 1) Receiver — the object that actually does the work
// ============================================================
class Document {
  private content = "";
  insertAt(pos: number, text: string) {
    this.content = this.content.slice(0, pos) + text + this.content.slice(pos);
  }
  deleteAt(pos: number, length: number) {
    this.content = this.content.slice(0, pos) + this.content.slice(pos + length);
  }
  getContent() { return this.content; }
}

// ============================================================
// 2) Command interface
// ============================================================
interface Command {
  execute(): void;
  undo(): void;
}

// ============================================================
// 3) Concrete commands — each captures the receiver + args + reverse info
// ============================================================
class InsertTextCommand implements Command {
  constructor(private doc: Document, private pos: number, private text: string) {}
  execute() { this.doc.insertAt(this.pos, this.text); }
  undo()    { this.doc.deleteAt(this.pos, this.text.length); }
}

class DeleteTextCommand implements Command {
  private deletedText = "";   // remembered for undo
  constructor(private doc: Document, private pos: number, private length: number) {}
  execute() {
    this.deletedText = this.doc.getContent().slice(this.pos, this.pos + this.length);
    this.doc.deleteAt(this.pos, this.length);
  }
  undo() { this.doc.insertAt(this.pos, this.deletedText); }
}

// ============================================================
// 4) Invoker — manages execution + history
// ============================================================
class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];        // a new action invalidates the redo stack
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
  }
}

// ============================================================
// 5) Client — wires it together
// ============================================================
const doc = new Document();
const history = new CommandHistory();

history.execute(new InsertTextCommand(doc, 0, "Hello"));
history.execute(new InsertTextCommand(doc, 5, " World"));
console.log(doc.getContent());   // "Hello World"

history.undo();
console.log(doc.getContent());   // "Hello"

history.undo();
console.log(doc.getContent());   // ""

history.redo();
console.log(doc.getContent());   // "Hello"
```

What this buys:

* **Undo/redo just works** — each command knows how to reverse itself.
* **History is data**, not code. You can persist it, replay it, branch it.
* **Adding `BoldCommand` or `ReplaceCommand`** is one new class. The CommandHistory doesn't change.
* **Toolbar → keyboard → menu** all create the *same* commands. No code duplication.

### 4b. Generic button + bound commands (decoupled invoker)

```ts
class Button {
  constructor(private label: string, private command: Command) {}
  click() { this.command.execute(); }
  rebind(c: Command) { this.command = c; }   // user customization
}

const undoBtn = new Button("Undo", { execute: () => history.undo(), undo: () => {} });
const insertHelloBtn = new Button("Hello", new InsertTextCommand(doc, 0, "Hello"));

undoBtn.click();
insertHelloBtn.click();
```

The `Button` class doesn't know what any of its commands do. You can build a generic button library and rebind commands at runtime — that's how every "customize keyboard shortcuts" UI works.

### 4c. Job Queue (Command for async / remote / batch)

A Command can be persisted, sent over the wire, and run later — by another process or another machine.

```ts
interface SerializableCommand extends Command {
  toJSON(): { type: string; payload: unknown };
}

class SendEmailCommand implements SerializableCommand {
  constructor(private to: string, private subject: string, private body: string) {}
  execute() { /* call SMTP */ }
  undo() { /* not supported for emails */ }
  toJSON() {
    return { type: "send_email", payload: { to: this.to, subject: this.subject, body: this.body } };
  }
}

class JobQueue {
  private queue: SerializableCommand[] = [];

  enqueue(cmd: SerializableCommand) {
    this.queue.push(cmd);
    persist(cmd.toJSON());   // imagine a Redis push
  }

  async runOne() {
    const cmd = this.queue.shift();
    if (cmd) await cmd.execute();
  }
}
```

This is essentially how Bull, Sidekiq, Celery, or your home-grown job queue work. The job is a Command; the queue is the Invoker.

### 4d. Macro Command (Composite + Command)

A Macro is a Command that wraps multiple Commands, executing them in order — Composite pattern over Command.

```ts
class MacroCommand implements Command {
  constructor(private commands: Command[]) {}
  execute() { this.commands.forEach(c => c.execute()); }
  undo()    { [...this.commands].reverse().forEach(c => c.undo()); }
}

// Bold + Italic + Underline as one undoable action
const triple = new MacroCommand([
  new ApplyBoldCommand(doc, 0, 5),
  new ApplyItalicCommand(doc, 0, 5),
  new ApplyUnderlineCommand(doc, 0, 5),
]);

history.execute(triple);    // pressing one button does all three
history.undo();             // reverses all three, in reverse order
```

Note the reversal order in `undo()`. If `Bold` was applied first and `Italic` second, undoing Italic before Bold is the correct LIFO discipline — same as how a transaction's compensating actions run.

### 4e. Function-form commands (lighter-weight)

When you don't need undo or serialization, a Command can just be a function.

```ts
type CommandFn = () => void;

class CommandRunner {
  private queue: CommandFn[] = [];
  enqueue(c: CommandFn) { this.queue.push(c); }
  runAll() { this.queue.forEach(fn => fn()); this.queue = []; }
}

const runner = new CommandRunner();
runner.enqueue(() => console.log("a"));
runner.enqueue(() => console.log("b"));
runner.runAll();   // a, b
```

This is essentially the Express/Koa middleware shape, or React's `setState(() => ...)` updaters.

---

## 5. Real-world Use Cases

* **Redux actions** — every action is a Command. The reducer is the dispatcher; the action is the operation. Replayable, debuggable, time-travel-able. Redux DevTools is *literally* a Command history viewer.
* **Undo/redo in editors** — VSCode, Photoshop, Figma, Google Docs, every IDE — all use Command pattern internally for the undo stack.
* **Job queues** — Bull, BullMQ, Sidekiq, Celery, Resque, AWS SQS message handlers, Cloud Tasks. The "job payload" is a Command; the worker is the Invoker.
* **Database transactions** — each operation in a transaction is a Command; the transaction log is a list of Commands; rollback reverses them.
* **Git commits** — every commit is a Command in the project's history. `git revert` runs the undo. `git rebase` is replaying commands. The pattern *is* version control.
* **CQRS / Event Sourcing** — Commands are the inputs; Events are the outputs; the system's state is built by replaying Events. Command pattern at architectural scale.
* **Macro recording** — Excel macros, Photoshop actions, IntelliJ macros. The user's actions are recorded as Commands; replay re-executes them.
* **Game input systems** — actions like `MoveLeft`, `Jump`, `FireWeapon` are Commands. Rebinding keys is "swap the Command bound to this key." Network-replay also leverages Command persistence.
* **HTTP request objects** — `axios.create({...}).get(url, opts)` returns a request that's effectively a Command before it executes.
* **Browser history** — `history.pushState`, `history.back`, `history.forward` are Command operations.
* **Worker tasks in `WebWorker` / threading APIs** — postMessage payloads are usually Commands.
* **Wizards / multi-step flows with back/next** — each step's submission is a Command that can be undone (back).
* **Test step recording (Cypress, Playwright)** — `cy.click(...).type(...).should(...)` queues Commands that the runner executes.
* **Drag-and-drop systems** — the drop is a Command applied to the target.
* **Functional `setState((prev) => next)` in React** — a deferred Command on the state.
* **Robotics / IoT** — "open valve V12 for 3s" sent as a serialized Command from the controller.

When you see anything called `Action`, `Job`, `Task`, `Op`, `Mutation`, `Request`, or `Event` (in the CQRS sense), you're looking at a Command.

---

## 6. Interview Questions

### Q1. Implement undo/redo using the Command pattern.

**Answer:** (See section 4a for full code; here's the walkthrough.)

I'd model:

1. **Receiver** — the thing being mutated (e.g., `Document`).
2. **Command interface** with `execute()` and `undo()`.
3. **Concrete commands**, each capturing the receiver + args + any state needed to reverse.
4. **Two stacks** in the invoker: `undoStack` and `redoStack`.

Flow:
* `execute(cmd)` — runs `cmd.execute()`, pushes onto undo stack, **clears redo stack** (a new action invalidates pending redos).
* `undo()` — pops undo stack, runs `cmd.undo()`, pushes onto redo stack.
* `redo()` — pops redo stack, runs `cmd.execute()`, pushes onto undo stack.

Things the interviewer wants to hear:

1. **The redo stack must be cleared** when a new command is executed mid-history. Otherwise you'd "redo" something that no longer makes sense.
2. **Each command captures whatever it needs to undo itself.** A `DeleteTextCommand` records what was deleted so it can be re-inserted on undo.
3. **Bounded history.** In a real editor, you cap the undo stack (say, 1000 entries) to avoid unbounded memory. Use a deque or shift the oldest entry.
4. **MacroCommand for compound actions.** "Replace word" might be Delete + Insert; one undo should reverse both.
5. **Idempotence considerations.** What if `execute()` was called twice? Define your contract: usually each command instance executes once, gets pushed to undo, and is later undone exactly once. Enforce or document.

---

### Q2. What's the difference between Command and Strategy?

**Answer:** Both encapsulate behavior in objects. The intent differs:

* **Strategy** — encapsulates *one of many algorithms* for the same operation. Plugged into a Context, often kept around for the long term, used many times. Question answered: "*how* should this operation run?"
* **Command** — encapsulates *one specific request*: receiver + method + args. Usually short-lived: created, executed (maybe queued or persisted first), then discarded. Question answered: "*what* operation should run?"

Mechanical test: does the object represent one of several *ways to do X* (Strategy), or *the request to do X with these specific arguments* (Command)?

There's a soft overlap with function-form variants (a callback could be either), but in class form the distinction is sharp:

* `compareFn` for `Array.sort` → Strategy (algorithm choice).
* `InsertTextCommand(doc, 0, "hello")` → Command (concrete request).

They also differ in how they interact with `undo`. Commands typically pair with `undo()`; strategies almost never do.

---

### Q3. How do Commands enable async / distributed processing?

**Answer:** Because a Command captures *the entire request* in an object, you can decouple **when** and **where** it runs from **who** invoked it.

* **Async/queueing**: instead of `cmd.execute()` immediately, push the Command into a queue. A worker pulls it later and executes. The caller returns instantly.
* **Persistence**: serialize the Command to JSON (or your message format) and store it. After a crash, replay from the log to recover state.
* **Distribution**: send a serialized Command over the network. A worker on another machine deserializes and executes. This is exactly how job queues (Sidekiq, BullMQ, Celery, AWS SQS) work.
* **Replay / time-travel**: keep an append-only log of executed Commands. To recreate state at any prior point, replay up to that point. This is the foundation of Event Sourcing.

The thing that makes all this possible is that a Command is **first-class data**, not a method call. You can put data in a queue; you can't put a method call in a queue.

A subtle but important point in real systems: when Commands are persisted and replayed, they should be **idempotent** (safe to run twice) or have a **unique id** so you can deduplicate. "Charge $100 from card X" should not double-charge if the queue retries.

---

### Q4. Walk me through a job queue using Command.

**Answer:**

```ts
interface Job {
  readonly type: string;
  execute(): Promise<void>;
  toJSON(): unknown;
}

class SendEmailJob implements Job {
  readonly type = "send_email";
  constructor(private to: string, private subject: string, private body: string) {}
  async execute() { await mailer.send(this.to, this.subject, this.body); }
  toJSON() { return { type: this.type, to: this.to, subject: this.subject, body: this.body }; }
}

class GenerateInvoiceJob implements Job {
  readonly type = "generate_invoice";
  constructor(private orderId: string) {}
  async execute() { await invoiceService.generate(this.orderId); }
  toJSON() { return { type: this.type, orderId: this.orderId }; }
}

class JobQueue {
  private queue: Job[] = [];

  enqueue(job: Job) {
    this.queue.push(job);
    persist(job.toJSON());        // e.g., Redis lpush
  }

  async run() {
    while (true) {
      const job = await this.dequeue();
      try { await job.execute(); }
      catch (e) {
        // retry / DLQ / alert
      }
    }
  }

  private async dequeue(): Promise<Job> {
    // imagine a blocking Redis brpop + JSON parse → instantiate the right Job class
    const json = await pop();
    return jobRegistry.fromJSON(json);
  }
}
```

Things the interviewer wants to hear:

1. **`Job` is a Command** — has `execute()`.
2. **Serialization** is part of the contract — jobs must be persistable.
3. **A registry** maps `type` strings to classes for deserialization.
4. **Idempotency**: each job should be safe to run twice (or carry a unique id for deduplication). Otherwise queue retries cause double-effects.
5. **Retries / dead-letter queue**: jobs that fail repeatedly need somewhere to go.
6. **Backpressure**: a queue that grows unbounded is a memory leak; mention bounded queues, rate limiting, or shedding.
7. **At-least-once vs exactly-once**: most queues guarantee at-least-once delivery, so idempotence on the Command side is essential.

That last point — idempotency, retries, backoff — is what separates a junior answer from a senior one. The Command is just the data; the queue's *delivery semantics* are where production systems live.

---

### Q5. When is Command overkill?

**Answer:** A few situations where the pattern adds noise:

1. **The operation is fire-and-forget with no need for undo, queueing, or logging.** A simple function call is fine. Wrapping `console.log("hi")` in a `LogCommand` is silly.
2. **There's exactly one Receiver and one operation, called from one place.** Command shines when there's *invoker/receiver decoupling*. If both sides are statically tied to one thing, indirection only adds files.
3. **Undo is genuinely impossible.** Sending an email, charging a card, or pushing a notification can't really be undone (only "compensated" by sending a follow-up). If your system can't actually reverse, don't fake it with a Command interface that has a useless `undo()`. Use Saga pattern or compensating-action workflows instead.
4. **Hot paths.** Command adds an allocation per call. In a 10-million-ops/sec inner loop, that overhead matters. Profile before adding indirection in performance-critical code.

The honest framing: Command is *one of the most useful patterns in the GoF book*, but its full value (undo, queueing, persistence, replay) only shows up when you actually need those features. For simple hand-offs, a function is fine.

---

## TL;DR Cheat Sheet

```
Command: encapsulate a request as an object so it can be queued, logged,
         undone, replayed, or composed.

Five participants:
  - Receiver       — the object that does the work
  - Command        — interface with execute() (and often undo())
  - ConcreteCommand — wraps receiver + method + args
  - Invoker        — triggers execute(); doesn't know what command does
  - Client         — wires commands to receivers, hands them to invokers

Use when:
  - undo/redo is needed
  - operations should be queueable / persistable / remoteable
  - same operation triggered from many UIs (button, key, menu, voice)
  - macro recording / replay
  - audit logging of state mutations

Don't use when:
  - simple fire-and-forget call with no decoupling needs
  - only one invoker and one receiver
  - undo is genuinely impossible (use Saga / compensating actions)

vs Strategy:
  - Strategy:  one of many *algorithms* (how to do X)
  - Command:  one specific *request* (do X with these args, on this object)

In TS: class form for undo/serialization/polymorphism;
       function form (closure) for fire-and-forget.

Combines well with:
  - Composite (MacroCommand: a command of commands)
  - Memento  (snapshot state for "perfect" undo when reverse logic is hard)
  - Observer (notify on command execution for logging/metrics)

Real-world: Redux actions, undo stacks in editors, job queues (Bull,
            Sidekiq, Celery), git commits, CQRS/Event Sourcing,
            macro recording, game input + key remapping, HTTP request
            objects, transaction logs, React setState((prev) => next).

Interview gold: implement undo/redo (two stacks; clear redo on new
                command). For job queues, talk idempotency + retries
                + DLQ + at-least-once semantics.
```
