# 20 — Prototype Pattern

> Phase 4 — Design Patterns → Creational
> Pattern type: Creational
> Difficulty: Easy concept, deep nuance around shallow vs deep cloning

---

## 1. Concept / Theory

**Prototype** lets you create new objects by **cloning an existing one** (the "prototype") instead of constructing from scratch.

You reach for it when:

* **Construction is expensive** — heavy DB lookup, file I/O, network call, complex computation. Clone instead of re-do.
* **You don't know the concrete class at compile time** — you have a reference to a base type, you want a new one of the same actual class. Cloning preserves the runtime type.
* **You need many similar objects with small variations** — clone the template and tweak. Game enemies, UI components, document templates.
* **Pre-configured "starting points" matter** — instead of remembering 12 init steps, you keep a fully-built prototype around and clone it whenever you need a fresh copy.

The mechanical recipe:

1. The class (or interface) defines a `clone()` method.
2. Each implementation knows how to copy itself.
3. Clients call `prototype.clone()` to get a new instance — they never call `new`.

### Shallow vs Deep clone — the part that trips people up

* **Shallow clone** — the new object's primitive fields are copied; references (objects, arrays) are *shared* with the original. Cheap and fast, but mutations to nested objects leak between original and copy.
* **Deep clone** — recursively copies everything. Independent object graph. Safe but more expensive, and tricky around circular refs, `Date`, `Map`, `Set`, class instances, functions.

Most cloning bugs in production come from one assumption: "I cloned it, so changes to the copy can't affect the original." That's only true for **deep** clones. Shallow clones share their nested state.

### JavaScript's special relationship with this pattern

JavaScript's entire object model is prototype-based:

```ts
const animal = { eat() { console.log("eating"); } };
const dog = Object.create(animal);   // dog uses animal as its prototype
dog.bark = () => console.log("woof");

dog.eat();  // works — looked up via the prototype chain
dog.bark(); // works — own property
```

`Object.create(proto)` literally **is** the Prototype pattern in the language. When you write `class Dog extends Animal`, under the hood `Dog.prototype.__proto__ === Animal.prototype`. So in JS the pattern is half-built into the runtime — but the **design pattern** specifically refers to *cloning instances* (not classes) for the reasons listed above.

---

## 2. Real-life Analogy

A **photocopier**. You have one good document; instead of retyping it from scratch, you make copies. Each copy is independent — you can scribble on it without changing the original — but creating it cost almost nothing because the source already existed.

A more modern analogy: **duplicating a Figma component** or **copying a Notion template page**. The template took someone an hour to design; new instances take one click. Each duplicate is a real, editable object with no link back to the source (well, unless the tool intentionally keeps a link — but that's the analogy for *Composition* with shared prototypes, not Prototype pattern).

In games: enemy spawning. Designing a "Goblin" with 47 stats, an animation set, an AI script, and a loot table is expensive. The level loader holds **one** Goblin prototype and clones it every time the player walks into a new room.

---

## 3. Bad Code Example — Re-Building From Scratch Every Time

```ts
// ❌ BAD: every spawn does the full expensive construction
class Goblin {
  constructor(
    public hp: number,
    public attack: number,
    public defense: number,
    public sprite: Sprite,            // loaded from disk
    public animations: AnimationSet,  // parsed from JSON
    public ai: BehaviorTree,          // compiled from a script file
    public loot: LootTable,           // computed from a probability matrix
  ) {}
}

class GoblinFactory {
  create(): Goblin {
    const sprite = Sprite.loadFromDisk("goblin.png");           // ~50ms
    const anims = AnimationSet.fromJson("goblin_anims.json");   // ~30ms
    const ai = BehaviorTree.compile("goblin_ai.script");        // ~80ms
    const loot = LootTable.compute(GoblinDropMatrix);           // ~10ms
    return new Goblin(50, 10, 5, sprite, anims, ai, loot);
  }
}

// in the game loop
for (let i = 0; i < 100; i++) {
  const enemy = new GoblinFactory().create();   // 170ms × 100 = 17 seconds of work
  spawnInRoom(enemy);
}
```

What's wrong:

1. **Repeated expensive work.** Sprite, animations, AI compile, loot table — these are *identical* for every Goblin. Doing them 100 times is pure waste.
2. **No notion of variation.** What if you want one Goblin with double HP? You either thread a parameter through the factory (and pollute the API), or you construct the Goblin and mutate it (and risk inconsistent state).
3. **Cache invalidation hidden.** If `goblin_ai.script` changes on disk between spawns, half your goblins get the old behavior. There's no controlled point at which the prototype is "set."

---

## 4. Good Code Example — Prototype in TypeScript

### 4a. Basic Prototype with a `clone()` method

```ts
interface Cloneable<T> {
  clone(): T;
}

class Goblin implements Cloneable<Goblin> {
  constructor(
    public hp: number,
    public attack: number,
    public defense: number,
    public readonly sprite: Sprite,
    public readonly animations: AnimationSet,
    public readonly ai: BehaviorTree,
    public readonly loot: LootTable,
  ) {}

  clone(): Goblin {
    // shallow clone — heavy assets (sprite, animations, ai, loot) are SHARED.
    // That's intentional: they're immutable, read-only resources.
    return new Goblin(this.hp, this.attack, this.defense,
                      this.sprite, this.animations, this.ai, this.loot);
  }
}

// Build the prototype ONCE
const goblinPrototype = new Goblin(
  50, 10, 5,
  Sprite.loadFromDisk("goblin.png"),
  AnimationSet.fromJson("goblin_anims.json"),
  BehaviorTree.compile("goblin_ai.script"),
  LootTable.compute(GoblinDropMatrix),
);

// Spawn N goblins — almost free now
for (let i = 0; i < 100; i++) {
  spawnInRoom(goblinPrototype.clone());
}

// Spawn a custom variant
const elite = goblinPrototype.clone();
elite.hp = 200;
elite.attack = 25;
spawnInRoom(elite);
```

The 170ms-per-goblin work is paid **once**. Each clone is an object allocation plus six reference copies — sub-millisecond.

### 4b. Deep clone when you actually need it

The basic clone above is shallow — `sprite`, `animations`, etc. are shared references. That's correct **if those nested objects are immutable**. If they're not, mutating one Goblin's state can leak into others.

For mutable nested data, you need a deep clone:

```ts
class Character implements Cloneable<Character> {
  constructor(
    public name: string,
    public stats: { hp: number; mp: number; xp: number },
    public inventory: string[],
  ) {}

  clone(): Character {
    return new Character(
      this.name,
      { ...this.stats },        // shallow copy of nested object
      [...this.inventory],      // shallow copy of array
    );
  }
}
```

For deeply nested arbitrary data, modern JS gives you `structuredClone` for free:

```ts
const deepCopy = structuredClone(original);
```

It handles:

* Plain objects, arrays, primitives.
* `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, typed arrays.
* **Circular references.**

It does **not** handle:

* Functions (throws).
* DOM nodes (throws in some environments).
* Class instances — copies the *data* but the result loses its prototype, becoming a plain object. So `cloned instanceof MyClass` is `false`.

That last point is the gotcha. If you need cloned instances to remain `instanceof` their class, write `clone()` manually or use a library (e.g. `lodash.cloneDeep`, which preserves prototypes).

The old `JSON.parse(JSON.stringify(obj))` trick still works for simple data but **fails** on `Date` (becomes string), `Map`/`Set` (becomes `{}`), `undefined` (dropped), functions (dropped), circular refs (throws). Use `structuredClone` instead — it landed in Node 17 and all modern browsers.

### 4c. Prototype Registry

Keep a directory of prototypes you can ask for by key. This is the Prototype-pattern equivalent of a Factory's lookup table.

```ts
class PrototypeRegistry {
  private prototypes = new Map<string, Cloneable<any>>();

  register(key: string, prototype: Cloneable<any>) {
    this.prototypes.set(key, prototype);
  }

  spawn<T>(key: string): T {
    const proto = this.prototypes.get(key);
    if (!proto) throw new Error(`No prototype registered for ${key}`);
    return proto.clone() as T;
  }
}

// bootstrap
const registry = new PrototypeRegistry();
registry.register("goblin", goblinPrototype);
registry.register("orc", new Orc(...));
registry.register("dragon", new Dragon(...));

// game loop
const enemy = registry.spawn<Goblin>("goblin");
```

Now the level loader doesn't need to know about Goblin/Orc/Dragon classes at all — it just asks for a key. New enemy types are added by registering their prototype; no caller changes.

This combines beautifully with **Factory + Prototype**: instead of switch-statementing on a key to choose `new GoblinFactory()` vs `new OrcFactory()`, you switch on a key to choose `goblinProto.clone()` vs `orcProto.clone()`. Same OCP win, but you skip all the per-spawn setup work.

### 4d. JavaScript's built-in version

Worth showing because interviewers sometimes ask about it:

```ts
const goblinTemplate = {
  hp: 50, attack: 10, defense: 5,
  describe() { return `Goblin HP=${this.hp}`; }
};

// Object.create — true prototype-based "inheritance"
const g1 = Object.create(goblinTemplate);
g1.hp = 100;                   // own property; doesn't affect template
console.log(g1.describe());    // "Goblin HP=100"
console.log(goblinTemplate.hp); // still 50

// But — g1 doesn't COPY the template, it DELEGATES to it.
// If you don't override hp on g1, g1.hp comes from the template.
// Mutating the template later affects all "clones".
goblinTemplate.attack = 20;
console.log(g1.attack);  // 20  — surprise!
```

`Object.create` is closer to **delegation** than **cloning**. It's prototype-*based* but not the Prototype design pattern. Mention this distinction in interviews if `Object.create` comes up.

---

## 5. Real-world Use Cases

* **Game engines** — Unity prefabs, Unreal blueprints. Designers build a template; the engine clones it at spawn time. This is the textbook use case.
* **Figma / Sketch / Notion duplicate** — a "Duplicate" command on any element is a Prototype clone.
* **Document templates** — invoice templates, email templates, contract templates. The template is built once, edits/data are filled in per use.
* **`structuredClone` and `JSON.parse(JSON.stringify(x))` idioms** — every time you've copied state in Redux, you've used Prototype semantics.
* **Immer / Immutable.js** — `produce(state, draft => { draft.x = 1 })` is a sophisticated Prototype that gives you copy-on-write semantics.
* **Object pools** with a master template — pool maintains a small number of pre-built objects, clones from the master when the pool empties.
* **Database "savepoint" snapshots** — clone the current row state before applying a risky operation; rollback by restoring the clone.
* **Spreadsheet "duplicate row"** — Excel, Google Sheets.
* **Test fixtures** — `const baseUser = { ... }; const adminUser = { ...baseUser, role: "admin" }`. Spread-clone with override is the Prototype pattern at sub-second granularity.
* **React `cloneElement(child, newProps)`** — clones a React element with overridden props. Used heavily in libraries like `react-router`, `framer-motion`.

That last one is worth dwelling on: every React dev who's used a library that "magically wraps your children" is using Prototype.

---

## 6. Interview Questions

### Q1. What's the difference between Prototype and Factory?

**Answer:** They both produce new objects, but they differ in how.

* **Factory** — *constructs* a new object. The factory holds the recipe (which class, which constructor args) and runs that recipe each time. The cost is paid every call.
* **Prototype** — *copies* an existing pre-built object. The expensive setup happened once when the prototype was created; every clone is a cheap copy.

Reach for Prototype when:

1. Construction is expensive (I/O, computation) and the result is reusable.
2. You want to preserve the runtime type without knowing it at compile time. `proto.clone()` returns the same concrete class as `proto`, even if your variable is typed as the base interface.

Reach for Factory when:

1. You need a brand-new, fully-fresh object — no shared state, no template assumptions.
2. Construction is cheap, so caching wouldn't help.
3. You want centralized control over *which* concrete class is chosen based on input.

The two often combine: a Factory whose internals call `prototype.clone()` rather than `new`.

---

### Q2. Shallow vs deep clone — which one does the Prototype pattern require?

**Answer:** It depends on the *semantics* of the object, not the pattern. The pattern says "produce an independent copy." Whether you achieve that with a shallow or deep clone depends on what's inside.

* If nested fields are **immutable** (string, number, frozen objects, immutable types), shallow clone is enough — sharing them is fine because no one can mutate them.
* If nested fields are **mutable** (plain objects, arrays, Map, Set, custom classes with setters), you need a deep clone — otherwise mutations on one clone leak into others.

A useful rule: **clone as deeply as the mutability extends.** If your immutable boundary is at level 2 of the object graph, copy levels 0 and 1; share level 2 onward. This avoids paying for unnecessary deep copies.

In modern JS, `structuredClone(obj)` is the easiest deep clone. The old `JSON.parse(JSON.stringify(obj))` is faster but loses `Date`/`Map`/`Set`/functions and crashes on circular references — avoid it.

---

### Q3. What's wrong with `JSON.parse(JSON.stringify(obj))` for cloning?

**Answer:** It silently corrupts several common types:

* `Date` — becomes a string (`"2026-05-10T..."`), no longer a `Date`.
* `Map`, `Set` — become empty `{}`.
* `undefined` values — dropped.
* Functions — dropped.
* Symbols — dropped.
* `BigInt` — throws.
* Circular references — throws.
* Class instances — lose their prototype; `cloned instanceof MyClass` is `false`.

It's fine for plain data (POJO with numbers/strings/booleans/arrays/nested objects), and very fast — that's why it persists. But the moment your data has any of the above, you get bugs. Use `structuredClone` (built-in, handles most cases including circular refs) or a library like `lodash.cloneDeep` (preserves class prototypes too).

---

### Q4. Walk me through a Prototype Registry for a UI component library.

**Answer:** Imagine a design-system component library with templates: `PrimaryButton`, `IconButton`, `LinkButton`, `DangerButton`, etc. Each is a configured `Button` with specific styles, sizes, ARIA attributes.

```ts
interface Cloneable<T> { clone(): T; }

class Button implements Cloneable<Button> {
  constructor(
    public text: string,
    public variant: "primary" | "secondary" | "danger" | "ghost",
    public size: "sm" | "md" | "lg",
    public disabled: boolean,
    public ariaLabel?: string,
  ) {}
  clone(): Button {
    return new Button(this.text, this.variant, this.size, this.disabled, this.ariaLabel);
  }
}

class ComponentRegistry {
  private prototypes = new Map<string, Cloneable<any>>();
  register(key: string, proto: Cloneable<any>) { this.prototypes.set(key, proto); }
  spawn<T extends Cloneable<T>>(key: string): T {
    const proto = this.prototypes.get(key);
    if (!proto) throw new Error(`Unknown component: ${key}`);
    return proto.clone() as T;
  }
}

// bootstrap
const registry = new ComponentRegistry();
registry.register("primaryBtn", new Button("Submit", "primary", "md", false));
registry.register("dangerBtn",  new Button("Delete", "danger",  "md", false));
registry.register("ghostBtn",   new Button("Cancel", "ghost",   "md", false));

// usage
const btn1 = registry.spawn<Button>("primaryBtn");
btn1.text = "Place Order";   // override

const btn2 = registry.spawn<Button>("dangerBtn");
btn2.text = "Delete forever";
btn2.size = "lg";
```

What the interviewer wants to hear:

1. Each clone is independent — you can mutate `btn1.text` without affecting the registry's prototype.
2. New variants are added by registering, not by code change.
3. Combines naturally with React: `<Button {...registry.spawn("primaryBtn")} onClick={...} />`.
4. Trade-off vs Factory: a Factory would re-run the constructor with all the defaults each time; with Prototype the defaults live in the registered instance. For Buttons it's a wash performance-wise, but for components that load images, fonts, or do heavy parsing on construction, Prototype wins.

---

### Q5. Why is JavaScript called "prototype-based" — is that the same as the Prototype pattern?

**Answer:** They're related but not the same.

JavaScript is "prototype-based" in its **inheritance model**: instead of class-based inheritance (where a child class is structurally derived from a parent class at compile time), JS objects link to *another object* called their prototype. Property lookups walk up the prototype chain at runtime. `class Dog extends Animal` is sugar over `Dog.prototype.__proto__ = Animal.prototype`.

The **Prototype design pattern**, on the other hand, is about **cloning instances** at runtime to avoid expensive construction. It's a higher-level idea about object creation that exists in any language — Java, C#, Python — regardless of whether the language has prototype-based inheritance.

The naming overlap is happy accident. JavaScript's `Object.create(proto)` does both things at once: creates a new object linked to `proto` (delegation) without calling `new` (which is what Prototype-the-pattern is also about), but the link means you don't get an independent copy — mutations to `proto` propagate.

So: JS's prototype chain ≠ the Prototype pattern. JS just makes some Prototype-pattern-flavored idioms easy.

---

## TL;DR Cheat Sheet

```
Prototype: create new objects by cloning an existing one.

Use when:
  - construction is expensive (I/O, computation, parsing)
  - you need many similar objects with small variations
  - you want to preserve runtime type without knowing it at compile time
  - pre-configured "starting templates" make sense

Shallow vs Deep clone:
  - Shallow: copies primitives, shares references. Fine if nested data is immutable.
  - Deep: recursively copies. Use structuredClone() in modern JS.

Pitfalls:
  - JSON.parse/stringify loses Date, Map, Set, functions, prototypes, circular refs.
  - structuredClone preserves more types but turns class instances into plain objects.
  - For class-instance-preserving deep clones: write clone() manually or use lodash.

vs Factory:
  - Factory: constructs from scratch each call.
  - Prototype: clones a pre-built template — saves expensive setup.

Real-world: game engines, Figma/Notion duplicate, React.cloneElement, Immer,
            test fixtures with spread/override, object pools.

JS-specific:
  - Object.create is delegation, not cloning — mutations to the prototype leak.
  - The "prototype chain" is JS's inheritance model, not the design pattern.
```
