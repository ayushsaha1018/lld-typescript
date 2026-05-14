# Lesson 07 — Utility Types

> **Phase 1 — TypeScript for LLD**
> The TypeScript toolbox of "type transformations". They're how you keep one source of truth for an entity and derive all the variants (DTOs, patches, public projections) from it.

---

## 1. Concept / Theory

A utility type is a **built-in generic type** that takes one or more types as input and produces a new type. They live entirely in the type system — zero runtime cost.

You'll use the Big Six daily:

| Utility | Reads as | Use it for |
|---------|----------|------------|
| `Partial<T>` | "all properties optional" | PATCH endpoints, builder methods, defaults |
| `Required<T>` | "all properties required" | Tighten up an interface for internal use |
| `Readonly<T>` | "no mutation allowed" | Frozen DTOs, response objects, value objects |
| `Pick<T, K>` | "keep only these keys" | Public projections, slimmed views |
| `Omit<T, K>` | "drop these keys" | Strip server-only fields (id, timestamps) before insert |
| `Record<K, V>` | "object with keys K and values V" | Lookup tables, dictionaries |

A few more you'll meet:

| Utility | Reads as |
|---------|----------|
| `NonNullable<T>` | "remove `null` and `undefined`" |
| `ReturnType<F>` | "the return type of function F" |
| `Parameters<F>` | "the parameter tuple of function F" |
| `Awaited<T>` | "unwrap a Promise<T> to T" |

### The mental shift

Without utility types you'd write the same shape in five places:
```ts
interface User           { id: string; name: string; email: string; createdAt: Date; }
interface CreateUserDto  { name: string; email: string; }                       // copy-paste
interface UpdateUserDto  { name?: string; email?: string; }                     // copy-paste
interface PublicUser     { id: string; name: string; }                          // copy-paste
```

With utility types, **one source of truth** drives all the rest:
```ts
interface User { id: string; name: string; email: string; createdAt: Date; }

type CreateUserDto = Omit<User, "id" | "createdAt">;
type UpdateUserDto = Partial<CreateUserDto>;
type PublicUser    = Pick<User, "id" | "name">;
```

Add a field to `User` once → every dependent type updates. **This is the lesson.**

---

## 2. Real-life Analogy

Think of a **passport application form** (the master record) and the various **derived forms** an embassy or company might generate from it:

- The **public-facing badge** prints just your name + photo → `Pick<Passport, "name" | "photo">`
- The **renewal form** has every field but lets you leave blanks where nothing changed → `Partial<Passport>`
- The **read-only PDF** can't be edited after issue → `Readonly<Passport>`
- The **internal HR record** has every field PLUS some you can't see, filled by the issuing officer → custom intersection
- The **submission form** doesn't include the passport number (that gets assigned later) → `Omit<Passport, "passportNumber">`

You don't redesign the passport form for each variant. You take the master and **transform** it. Utility types are exactly that transformation.

---

## 3. Bad Code (what NOT to do)

### Bad pattern A — duplicated DTOs

```ts
// ❌ BAD: User shape repeated five times, with subtle drift
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  passwordHash: string;
  createdAt: Date;
}

interface CreateUserBody {       // copy-paste minus id, createdAt, passwordHash
  name: string;
  email: string;
  age: number;
}

interface UpdateUserBody {       // copy-paste with all-optional
  name?: string;
  email?: string;
  age?: number;
}

interface PublicUserResponse {   // copy-paste minus password
  id: string;
  name: string;
  email: string;
  age: number;
  createdAt: Date;
}
```

**Why it fails:**
1. Add a field to `User` (`phoneNumber`). You must remember to update **four** other interfaces. You will forget one.
2. Subtle drift — six months later, `name` is `string | null` in one interface and `string` in another. No one notices until a bug.
3. The relationships between these types — "Update is Partial Create" — are *invisible* in the code. A new dev has to infer it.
4. If you decide to make `passwordHash` mandatory tomorrow, you have to manually re-check it doesn't leak into `PublicUserResponse`. Easy to mess up; security-sensitive.

### Bad pattern B — `any` to dodge the type plumbing

```ts
// ❌ BAD: bypassing the type system instead of using utility types
function patch(user: User, changes: any) {     // any!
  return { ...user, ...changes };
}
```

`changes` should be `Partial<User>`. With `any`, the compiler won't catch when you patch with `{ unknownField: "oops" }` or wrong types.

### Bad pattern C — leaking server-only fields

```ts
// ❌ BAD: serializing the entire User to the client
app.get("/me", (req, res) => res.json(req.user));   // returns passwordHash 😱
```

Without a typed `PublicUser` projection, every developer has to remember which fields are safe. They will not.

---

## 4. Good Code (the right way)

### A complete, modern user-entity flow

```ts
// ── single source of truth ──
interface User {
  id: string;
  name: string;
  email: string;
  age: number;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── derived types ──

// What the client may send to create a user
type CreateUserInput = Omit<User, "id" | "passwordHash" | "createdAt" | "updatedAt"> & {
  password: string;     // raw password from client; we hash it server-side
};

// What the client may send to update a user — all fields optional
type UpdateUserInput = Partial<CreateUserInput>;

// What the server may send back to the client (no secrets)
type PublicUser = Omit<User, "passwordHash">;

// Read-only snapshot for caching / event payloads
type ReadonlyUser = Readonly<PublicUser>;

// ── usage ──

function createUser(input: CreateUserInput): PublicUser {
  const user: User = {
    id: crypto.randomUUID(),
    ...input,
    passwordHash: hash(input.password),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  // ... save
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

function updateUser(id: string, changes: UpdateUserInput): PublicUser {
  // ... merge and save
}
```

What this buys you:
- One shape — `User` — drives the whole graph. Add a field there, and TS shows you everything that needs updating.
- Server-only fields (`passwordHash`) are stripped at the type boundary. The compiler refuses to leak them.
- Update endpoints accept partial updates *automatically* via `Partial<>`.

### `Pick` for public projections

```ts
type UserCardProps = Pick<User, "id" | "name" | "email">;

function UserCard({ id, name, email }: UserCardProps) { /* ... */ }
```

The component only declares what it consumes. Refactor `User` (rename `email` → `emailAddress`) and TS finds every component using it.

### `Record` for lookup tables

```ts
type Role = "admin" | "editor" | "viewer";

const permissions: Record<Role, string[]> = {
  admin:  ["read", "write", "delete"],
  editor: ["read", "write"],
  viewer: ["read"],
};

permissions.admin;          // ✅ string[]
permissions.superadmin;     // ❌ not in Role
```

If you add `"owner"` to `Role`, TS forces `permissions` to handle it. Exhaustive by construction.

### `ReturnType` and `Parameters` — typed adapters

```ts
function getUserFromDb(id: string) {
  return { id, name: "...", email: "..." };
}

type DbUser = ReturnType<typeof getUserFromDb>;
type DbUserParams = Parameters<typeof getUserFromDb>;   // [string]
```

Why this is great: the type follows the function. Refactor `getUserFromDb` to return a different shape, and `DbUser` updates automatically.

### Combining utilities — building exactly the shape you need

```ts
// All fields optional EXCEPT id (which we always need)
type UpdatePayload<T extends { id: string }> =
  Partial<Omit<T, "id">> & Pick<T, "id">;

const change: UpdatePayload<User> = {
  id: "u1",
  email: "new@example.com",
};
```

This is the kind of small, expressive type definition that makes mature TS code so robust.

### Custom utility — `DeepReadonly` (advanced, but a common interview probe)

```ts
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

`Readonly<T>` only shallow-freezes. When interviewers ask "how would you make a deeply immutable object?", this is the answer. Don't memorize verbatim — understand it: `keyof T` gets every key, `[K in keyof T]` is a *mapped type*, and we recurse.

---

## 5. Real-world Use Cases

- **Express / NestJS controllers** — `@Body() body: CreateUserDto` where `CreateUserDto = Omit<User, "id">`. The contract is derived, not duplicated.
- **React props** — `Pick` and `Omit` are how you say "this child only takes these props from the parent's props". Cuts coupling instantly.
- **Redux state slices** — `Partial<State>` for action payloads that update some-but-not-all fields.
- **GraphQL / Prisma generated types** — both heavily use mapped + utility types. `Prisma.UserCreateInput` and `Prisma.UserUpdateInput` are essentially `Partial<Omit<User, ...>>`-shaped.
- **Form libraries (react-hook-form, formik)** — `useForm<Partial<User>>()` is a common idiom while a form is being filled in.
- **Repository patterns** — `repo.update(id, changes: Partial<T>)`. Without `Partial`, you'd have to retype every variant.

The single sentence: **derive, don't duplicate.**

---

## 6. Interview Questions (with answers)

### Q1. *"What's the difference between `Pick<T, K>` and `Omit<T, K>`?"*

**Answer.** They're complementary.
- `Pick<T, K>` keeps only the keys in `K` and discards the rest.
- `Omit<T, K>` keeps everything *except* the keys in `K`.

```ts
type User = { id: string; name: string; email: string; password: string };
type PublicUser   = Pick<User, "id" | "name" | "email">;        // 3 fields
type SafeUser     = Omit<User, "password">;                     // same 3 fields
```

Practical rule: **prefer `Pick` when you want a small subset; prefer `Omit` when you want most fields except a few sensitive ones.** They tell the next reader your intent clearly.

### Q2. *"Why is `Partial<T>` useful and what's the catch?"*

**Answer.** It's how you describe "any subset of T". Used everywhere — PATCH endpoints, builder methods, partial updates, defaults objects.

The catch: `Partial<T>` is shallow. If `T` has nested objects, those *aren't* made partial. For deep partial behavior:

```ts
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};
```

Mention `DeepPartial` if asked about updating nested forms or trees.

### Q3. *"Walk me through `Record<K, V>` with an example."*

**Answer.** `Record<K, V>` describes an object whose **keys are of type K** and **values are of type V**.

```ts
type Status = "pending" | "active" | "banned";
type Counts = Record<Status, number>;
const userCounts: Counts = { pending: 10, active: 200, banned: 3 };
userCounts.pending;   // number
userCounts.foo;       // ❌
```

Three things to highlight:
1. When `K` is a **union of literals**, every key must be present — exhaustive.
2. When `K` is just `string`, it's a generic dictionary (any string key is allowed).
3. `Record<K, V>` is shorthand for `{ [P in K]: V }` — a mapped type.

### Q4. *"What's a mapped type, and how is it related to utility types?"*

**Answer.** A mapped type produces a new object type by **iterating over keys** of an existing one:

```ts
type Stringify<T> = { [K in keyof T]: string };
type Optional<T>  = { [K in keyof T]?: T[K] };
type Frozen<T>    = { readonly [K in keyof T]: T[K] };
```

Most utility types **are** mapped types under the hood:
- `Partial<T> = { [K in keyof T]?: T[K] }`
- `Readonly<T> = { readonly [K in keyof T]: T[K] }`
- `Required<T> = { [K in keyof T]-?: T[K] }` (the `-?` strips optionality)

You're expected to recognize this in interviews — and to write a mapped type when asked something like "type a function that turns every property of an object into a string".

### Q5. *"How would you type the `update` method of a Repository?"*

**Answer.** With utility types you can express it precisely:

```ts
interface Identifiable { id: string; }

class Repository<T extends Identifiable> {
  update(id: string, changes: Partial<Omit<T, "id">>): Promise<T> {
    /* ... */
  }
}
```

Reading the type aloud: "an object with **any subset** of T's fields, **except** `id`". You can't accidentally update the id. You can update any subset of the rest. This is the kind of type that makes the API self-documenting.

### Q6. *"What does `keyof T` mean and where have you used it?"*

**Answer.** `keyof T` is the union of property names of `T`:

```ts
interface User { id: string; name: string; age: number; }
type UserKey = keyof User;   // "id" | "name" | "age"
```

I've used it for typed accessors (`pick<T, K extends keyof T>`), for typed event maps (`emit<E extends keyof Events>(event: E, payload: Events[E])`), and for typed sort/filter helpers (`sortBy<T, K extends keyof T>(arr: T[], key: K)`). It's the foundation of half the cool patterns in TS.

### Q7 (bonus). *"What's `NonNullable<T>` and when do you use it?"*

**Answer.** `NonNullable<T> = T extends null | undefined ? never : T`. Strips `null` and `undefined` from a type.

```ts
type Maybe = string | number | null | undefined;
type Definite = NonNullable<Maybe>;   // string | number
```

Common after a runtime narrowing: a value was `T | null`, you've already null-checked, and now downstream functions take `NonNullable<T>`.

---

## Recap — what to remember

1. Utility types let you **derive** related types from a single source of truth. **Derive, don't duplicate.**
2. The Big Six: `Partial`, `Required`, `Readonly`, `Pick`, `Omit`, `Record`. Memorize what each does in one sentence.
3. Build precise APIs by **composing** utilities: `Partial<Omit<T, "id">>`, `Pick<T, "id" | "name">`, etc.
4. Most utilities are **mapped types** under the hood: `[K in keyof T]?: T[K]`. Recognize this.
5. `keyof T`, `ReturnType<F>`, `Parameters<F>`, `NonNullable<T>` are the secondary toolkit you'll reach for in real code.
6. **Beware shallowness.** `Partial`, `Readonly`, `Required` are shallow. For nested data, write `DeepPartial`, `DeepReadonly` — and know how.

---

## What's next
Lesson 08 — **Dependency Injection Basics**: the *why* behind constructor injection, manual DI vs framework DI, and how it ties together everything we've covered (interfaces, composition, generics) into testable, swappable code.
