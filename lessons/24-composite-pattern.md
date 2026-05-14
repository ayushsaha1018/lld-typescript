# 24 — Composite Pattern

> Phase 4 — Design Patterns → Structural
> Pattern type: Structural
> Difficulty: Easy concept, beautifully clean when it fits

---

## 1. Concept / Theory

**Composite** lets you treat **individual objects** and **compositions of objects** uniformly. Both implement the same interface, so client code doesn't have to ask "is this a single thing or a group?" — it just calls the method.

The structural shape is a **tree**:

* **Leaf** nodes — atomic, no children. They actually do the work.
* **Composite** nodes — contain children (which can be leaves or other composites). They typically delegate work to their children and combine results.

Both implement the **Component** interface, which is the magic — that's what lets clients call `node.render()` or `node.size()` without checking what kind of node it is.

```
                  ┌────────────────────────┐
                  │     Component          │   (interface)
                  │ + operation()          │
                  └──────────┬─────────────┘
                             △
              ┌──────────────┴──────────────┐
              │                             │
       ┌──────────────┐             ┌────────────────┐
       │     Leaf     │             │   Composite    │
       │ + operation()│             │ + operation()  │
       └──────────────┘             │ + add(child)   │
                                    │ + remove(child)│
                                    │ + children: [] │
                                    └────────┬───────┘
                                             │
                                          ◇──┴──◇  contains 0..* Component
```

The Composite's `operation()` typically iterates over its children and calls *their* `operation()` — recursion that mirrors the tree.

### When you reach for it

* Your domain has a **part-whole hierarchy** (file/folder, component/container, person/team).
* You want operations to apply to the **whole tree or any subtree** uniformly (`size`, `render`, `search`, `serialize`).
* You'd otherwise have client code branching on "is this a single thing or a group?" everywhere.

### The defining win

Without Composite, client code looks like:

```ts
if (node instanceof Folder) {
  let total = 0;
  for (const child of node.children) total += getSize(child);
  return total;
} else {
  return (node as File).size;
}
```

With Composite, it looks like:

```ts
return node.size();
```

Polymorphism replaces branching. The recursion is **inside the data structure**, not in the caller.

### Two design choices: Transparent vs Safe Composite

A real interview question. Where do `add(child)` and `remove(child)` live?

* **Transparent Composite** — `add`/`remove` are on the **Component** interface (so leaves have them too). Clients can treat *any* node uniformly, but a leaf's `add()` either no-ops or throws. *Type safety is sacrificed for uniformity.*
* **Safe Composite** — `add`/`remove` are *only* on the Composite. Clients must distinguish leaves from composites when adding children. *Uniformity is sacrificed for type safety.*

Modern TypeScript code typically goes Safe — the type system makes it ergonomic to keep the distinction, and you avoid the "method that throws on leaves" smell.

---

## 2. Real-life Analogy

A **file system**. `du -sh ~/projects` works the same whether `~/projects` is a single file or a folder containing thousands of files in nested subfolders. The command doesn't care; it asks each thing for its size, and the folders ask their contents recursively.

Other clean analogies:

* **Org chart.** "How much does this team cost?" works on an individual contributor (their salary) or on a manager (sum of all reports' costs). The manager doesn't break the abstraction; they just aggregate.
* **Boxes inside boxes when shipping.** A box contains items or smaller boxes. "What's the total weight?" recurses naturally.
* **Math expressions.** `(2 + 3) * (4 - 1)`. The whole expression and any sub-expression both have a `.evaluate()` method. The tree-shaped structure is exactly the AST your compiler builds.
* **Menus.** A menu item might be a leaf ("Open File") or a submenu ("Recent Files →") that holds more items. Rendering recurses.

---

## 3. Bad Code Example — Type-Checking Tree Traversal

This is what code looks like when you model "files and folders" as separate types and let the difference leak everywhere.

```ts
// ❌ BAD: File and Folder are unrelated, every operation branches
class File {
  constructor(public name: string, public size: number) {}
}

class Folder {
  children: (File | Folder)[] = [];
  constructor(public name: string) {}
}

// callers have to know the difference
function getTotalSize(node: File | Folder): number {
  if (node instanceof File) {
    return node.size;
  } else {
    let total = 0;
    for (const child of node.children) {
      total += getTotalSize(child);  // recursion lives in the CALLER
    }
    return total;
  }
}

function listAllFileNames(node: File | Folder): string[] {
  if (node instanceof File) {
    return [node.name];
  } else {
    return node.children.flatMap(listAllFileNames);
  }
}

function findByExtension(node: File | Folder, ext: string): File[] {
  if (node instanceof File) {
    return node.name.endsWith(ext) ? [node] : [];
  } else {
    return node.children.flatMap(c => findByExtension(c, ext));
  }
}
```

What's wrong:

1. **Every operation knows about every type.** `getTotalSize`, `listAllFileNames`, `findByExtension` — all branch on `instanceof`.
2. **Recursion lives in callers, not in the structure.** Three operations, three identical traversal patterns.
3. **Adding `Symlink` requires editing every operation.** That's an Open/Closed violation — the system is *not* closed for modification.
4. **Visitors and reducers are awkward.** Anyone who needs to walk the tree has to repeat the pattern.

This isn't terrible code on a small scale, but it doesn't scale. Once you have a dozen tree operations, the duplicated branching becomes a maintenance burden.

---

## 4. Good Code Example — Composite in TypeScript

### 4a. File system tree (the classic)

```ts
// ============================================================
// 1) Component interface — what every node exposes
// ============================================================
interface FsNode {
  readonly name: string;
  size(): number;
  list(indent?: string): string;
  find(predicate: (n: FsNode) => boolean): FsNode[];
}

// ============================================================
// 2) Leaf — a single file
// ============================================================
class FileNode implements FsNode {
  constructor(public readonly name: string, private readonly bytes: number) {}

  size(): number { return this.bytes; }

  list(indent = ""): string {
    return `${indent}- ${this.name} (${this.bytes}B)`;
  }

  find(predicate: (n: FsNode) => boolean): FsNode[] {
    return predicate(this) ? [this] : [];
  }
}

// ============================================================
// 3) Composite — a folder containing children
// ============================================================
class FolderNode implements FsNode {
  private children: FsNode[] = [];

  constructor(public readonly name: string) {}

  add(child: FsNode): this { this.children.push(child); return this; }
  remove(child: FsNode): this { this.children = this.children.filter(c => c !== child); return this; }

  // Recursion lives HERE, not in callers
  size(): number {
    return this.children.reduce((sum, c) => sum + c.size(), 0);
  }

  list(indent = ""): string {
    const header = `${indent}+ ${this.name}/`;
    const body = this.children.map(c => c.list(indent + "  ")).join("\n");
    return body ? `${header}\n${body}` : header;
  }

  find(predicate: (n: FsNode) => boolean): FsNode[] {
    const self = predicate(this) ? [this as FsNode] : [];
    const fromChildren = this.children.flatMap(c => c.find(predicate));
    return [...self, ...fromChildren];
  }
}

// ============================================================
// 4) Build a tree
// ============================================================
const root = new FolderNode("project");
const src  = new FolderNode("src");
const tests = new FolderNode("tests");

src.add(new FileNode("index.ts", 1024))
   .add(new FileNode("utils.ts", 512));

tests.add(new FileNode("index.test.ts", 800));

root.add(src)
    .add(tests)
    .add(new FileNode("README.md", 2048))
    .add(new FileNode("package.json", 150));

// ============================================================
// 5) Use it — UNIFORMLY
// ============================================================
console.log("Total size:", root.size(), "bytes");        // 4514
console.log("\n" + root.list());
// + project/
//   + src/
//     - index.ts (1024B)
//     - utils.ts (512B)
//   + tests/
//     - index.test.ts (800B)
//   - README.md (2048B)
//   - package.json (150B)

const tsFiles = root.find(n => n.name.endsWith(".ts"));
console.log("TS files:", tsFiles.map(f => f.name));     // ["index.ts", "utils.ts", "index.test.ts"]
```

What changed from the bad version:

* **Caller code has no `instanceof` checks.** It just calls `root.size()`, `root.list()`, `root.find(...)` — no branching on type.
* **Recursion lives inside the composite.** Every operation that walks the tree is implemented once, in `FolderNode`.
* **Adding `SymlinkNode` is one new class.** Existing operations keep working; existing callers are untouched. Open/Closed satisfied.
* **The fluent `add()` returns `this`** — a small ergonomic touch. Common in builder-influenced APIs.

### 4b. UI component tree (the modern equivalent)

This is essentially React's mental model in 30 lines.

```ts
interface UIElement {
  render(): string;
}

class Text implements UIElement {
  constructor(private content: string) {}
  render() { return this.content; }
}

class Button implements UIElement {
  constructor(private label: string) {}
  render() { return `<button>${this.label}</button>`; }
}

class Container implements UIElement {
  private children: UIElement[] = [];
  constructor(private tag: "div" | "section" | "form" = "div") {}

  add(el: UIElement): this { this.children.push(el); return this; }
  render(): string {
    return `<${this.tag}>${this.children.map(c => c.render()).join("")}</${this.tag}>`;
  }
}

const ui = new Container("form")
  .add(new Text("Sign in"))
  .add(new Container("div").add(new Button("Login")).add(new Button("Sign up")));

console.log(ui.render());
// <form>Sign in<div><button>Login</button><button>Sign up</button></div></form>
```

This is *exactly* what every frontend framework's component tree is. Children are `UIElement[]` regardless of whether they're leaf widgets or other containers.

### 4c. Pricing & discounts (a less obvious use case)

Composite isn't only for visible trees. It works any time you have a "thing or a group of things" that share an operation.

```ts
interface PricedItem {
  total(): number;
}

class Product implements PricedItem {
  constructor(public name: string, public price: number) {}
  total() { return this.price; }
}

class Bundle implements PricedItem {
  private items: PricedItem[] = [];
  constructor(public name: string, private discountPct = 0) {}
  add(i: PricedItem): this { this.items.push(i); return this; }
  total() {
    const sum = this.items.reduce((s, i) => s + i.total(), 0);
    return sum * (1 - this.discountPct);
  }
}

const cart = new Bundle("Cart")
  .add(new Product("Pen", 5))
  .add(new Bundle("Stationery Bundle", 0.10) // 10% off the bundle
    .add(new Product("Pencil", 3))
    .add(new Product("Notebook", 12)))
  .add(new Product("Backpack", 50));

console.log(cart.total());
// 5 + (3 + 12) * 0.9 + 50 = 68.5
```

Bundles can contain bundles can contain products — same `total()` interface throughout. Discounts compose naturally.

### 4d. Transparent vs Safe Composite

A quick illustration of the design choice:

```ts
// Transparent Composite (children API on every node)
interface FsNode_T {
  size(): number;
  add(child: FsNode_T): void;
  remove(child: FsNode_T): void;
}
class TFile implements FsNode_T {
  size() { return 100; }
  add(_: FsNode_T) { throw new Error("file has no children"); }   // smell
  remove(_: FsNode_T) { throw new Error("file has no children"); }
}

// Safe Composite (children API only on Composite)
interface FsNode_S { size(): number; }
class SFile implements FsNode_S { size() { return 100; } }
class SFolder implements FsNode_S {
  private children: FsNode_S[] = [];
  size() { return this.children.reduce((s, c) => s + c.size(), 0); }
  add(c: FsNode_S) { this.children.push(c); }
}
```

In TS, **prefer Safe**. The compiler protects you from `.add()` on a file. The price is that anywhere you want to *add to a tree*, you need to know you're holding a `Folder`, not a `Node`. That's usually fine.

---

## 5. Real-world Use Cases

* **DOM tree** — `Element`, `Text`, `Comment` all implement `Node`. `node.textContent` walks the tree; you don't ask "is this a Text or a comment or a div?"
* **React Virtual DOM** — `<Foo><Bar/><Baz/></Foo>` is a Composite. The reconciler treats components and host elements (DOM nodes) uniformly via the `ReactElement` interface.
* **File systems** — `find`, `du`, recursive `chmod`, `tar` traversal. POSIX directory entries are Composite leaves and folders.
* **AST / IR in compilers** — `Expression` is the component; `BinaryOp`, `Literal`, `FunctionCall` are leaves and composites. `evaluate()`, `print()`, `optimize()` recurse.
* **Spring application context / DI containers** — beans can be groups of beans, addressed uniformly.
* **GraphQL selection sets** — a query is a tree of fields; each field can be a leaf or have a sub-selection. Resolvers walk it Composite-style.
* **Org chart software** — "give me the headcount under this person" works the same on an IC (1) or a VP (sum of reports recursively).
* **Permission groups** — a Group can contain Users *or* sub-Groups. `hasMember(user)` recurses.
* **Splitwise / expense splitters** — a Split can be a flat amount or a sub-split with its own ratio.
* **Test suites** — Jest / Vitest / Mocha: a `describe()` block contains `it()`s and other `describe()`s. Reporting recursion is Composite.
* **Menu hierarchies** — IDE command palettes, restaurant menus, Slack settings.
* **3D scene graphs** — a `SceneNode` has a transform; can contain meshes (leaves) or other scene nodes. Game engines all use this.
* **Filesystems' build configs** — `package.json` workspaces, monorepo trees.

The single most important real-world example for you as a frontend dev: **React's children prop is Composite**. When a component renders `{children}` and doesn't care whether each child is a `<button>` or another `<div><button/></div>`, that's polymorphism over the Composite shape.

---

## 6. Interview Questions

### Q1. What's the difference between Composite and Decorator?

**Answer:** They look similar — both involve one object that holds another via the same interface — but their *intent* is different.

* **Decorator** — adds behavior to a single wrapped object. Always 1-to-1 wrapping. Stackable. The wrapper changes *what happens*; the structure is linear.
* **Composite** — represents a tree. A composite holds *many* children, each of which can be a leaf or another composite. The structure is hierarchical; the operation aggregates over children.

A useful test: if you're stacking layers (logging + cache + retry around one client), it's Decorator. If you're building a tree (folders containing files containing... wait, files don't contain anything; folders containing folders and files), it's Composite.

They can also coexist: a `LoggingFolderNode` decorator wrapping a `FolderNode` composite — that's logging the operations at the tree level.

---

### Q2. Transparent vs Safe Composite — which one and why?

**Answer:** **Safe** in TypeScript and most modern languages.

* **Transparent**: putting `add(child)` and `remove(child)` on the Component interface. Every node has these methods, even leaves. Pro: any caller can treat any node uniformly. Con: leaves' `add()` either no-ops or throws — that's a runtime error waiting to happen and a Liskov substitution violation (subtypes shouldn't break expectations).
* **Safe**: keeping `add`/`remove` on the Composite class only. Clients must distinguish leaves from composites when adding children. Pro: no method that throws on a subset of types; the type system protects you. Con: clients that build trees need to know they're holding a Composite.

The original GoF book actually leans toward Transparent because it gives uniform handling. Modern practice has shifted toward Safe because static type systems make the distinction comfortable, and "method that throws on certain subtypes" is a code smell. I'd argue Safe in interviews and call out the trade-off.

---

### Q3. When is Composite NOT the right pattern?

**Answer:** A few situations where reaching for Composite is overkill or wrong:

1. **The hierarchy is fixed-depth.** If your "tree" is always exactly two levels (e.g., `Order → OrderItem`), you don't need Composite — composition (the OOP technique, lowercase) is enough. Composite shines when the depth is *recursive and unbounded*.
2. **Children behave fundamentally differently from the parent.** If `Folder` and `File` need genuinely different APIs (folders have permissions inheritance, files don't, etc.), forcing them to share a Component interface creates leaky abstractions or methods that error on certain types. That's a Safe Composite at best, or a sign you should model them separately.
3. **Operations are not uniform across the tree.** If half your operations only make sense on leaves and the other half only on composites, the unification doesn't buy you much. You're just adding a level of indirection.
4. **The tree is a query result, not a long-lived structure.** If the "tree" only exists during one request to assemble a response, plain functions over arrays may be simpler.

The senior framing: Composite is great when there's a recursive part-whole relationship and operations apply uniformly. If either condition fails, simpler models often win.

---

### Q4. Walk me through implementing a `du -sh` command using Composite.

**Answer:** I'd model the file system as a Composite where every node implements a single `size()` method.

```ts
interface FsNode {
  readonly name: string;
  readonly path: string;
  size(): number;
}

class FileNode implements FsNode {
  constructor(public readonly name: string, public readonly path: string,
              private readonly bytes: number) {}
  size() { return this.bytes; }
}

class FolderNode implements FsNode {
  private children: FsNode[] = [];
  constructor(public readonly name: string, public readonly path: string) {}
  add(c: FsNode) { this.children.push(c); }
  size(): number {
    return this.children.reduce((sum, c) => sum + c.size(), 0);
  }
}

function du(root: FsNode): string {
  const bytes = root.size();
  const units = ["B", "K", "M", "G", "T"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)}${units[i]}\t${root.path}`;
}
```

Key things to highlight:

1. The recursion is **inside `FolderNode.size()`**, not in the caller. `du()` itself has no idea whether `root` is a file or folder.
2. **Symlinks would be a new leaf class** with its own `size()` — maybe returning 0 (don't follow), or the target's size (follow). Adding symlink handling doesn't touch existing classes.
3. **Caching** is a natural extension. `FolderNode.size()` could memoize until invalidated. Layered as a Decorator if you want it optional.
4. **`du -sh`** prints just the root's total; **`du -h`** would print every directory it visited. Both are one-liners with a Visitor on top of the Composite (preview of the next visitor pattern).

---

### Q5. How does Composite relate to recursion? Are they the same thing?

**Answer:** No, but they're closely related.

Recursion is a *technique* — a function that calls itself. Composite is a *structural pattern* — a way of organizing classes so that part-whole hierarchies have a uniform interface.

Composite *uses* recursion in its implementation: a composite's operation typically calls the same operation on its children, which may themselves be composites, and so on. But you can have:

* **Recursion without Composite** — a recursive function over a plain array of objects. No interface unification, no part-whole pattern.
* **Composite without (visible) recursion** — bounded-depth trees where iteration replaces recursion in the implementation, or trees walked iteratively with an explicit stack to avoid stack overflow on deep trees.

The interview-worthy point: when your tree gets deep enough that recursion would overflow (millions of nodes), you switch to iterative traversal *inside* the composite's method, but the *external* shape and intent of the pattern is unchanged. Clients still call `root.size()`; the implementation just uses a stack instead of recursive calls.

---

## TL;DR Cheat Sheet

```
Composite: treat individual objects (Leaves) and groups (Composites)
           uniformly via a shared Component interface.

Recipe:
  1. Component interface — methods that every node supports
  2. Leaf — atomic node that does the work
  3. Composite — node that holds children and delegates to them
  4. Recursion lives INSIDE the Composite, not in callers

Use when:
  - part-whole hierarchy (file/folder, container/widget, group/member)
  - operations apply uniformly to the whole tree or any subtree
  - you'd otherwise have `instanceof` branches everywhere

Don't use when:
  - hierarchy is fixed-depth (just use composition)
  - leaves and composites need fundamentally different APIs
  - operations are not uniform across the tree

Two design choices:
  - Transparent: add/remove on every Node — uniform but throws on leaves
  - Safe: add/remove only on Composite — type-safe, slight loss of uniformity
  - In TS, prefer Safe.

vs Decorator: Decorator = 1:1 layered wrapping for behavior.
              Composite = 1:many tree structure for aggregation.

Real-world: DOM, React VDOM, file systems, ASTs, GraphQL selection sets,
            org charts, permission groups, scene graphs, expense splits,
            test suites with describe/it.

Frontend-specific gold: React's `children` prop IS Composite.
```
