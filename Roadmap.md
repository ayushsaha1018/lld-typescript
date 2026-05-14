# Low-Level Design (LLD) Roadmap for Interviews — TypeScript Edition

Since you already know TypeScript and have frontend/full-stack experience, learning LLD in TS is a very good choice. You’ll focus on:

* OOP + clean architecture
* Designing extensible systems
* Writing maintainable code
* Solving interview-style design problems

TypeScript is excellent for this because interfaces, generics, access modifiers, and typing make design concepts much clearer.

---

# Phase 0 — Goal of LLD Interviews

LLD interviews test whether you can:

* Structure code well
* Model entities properly
* Use OOP principles
* Write extensible systems
* Apply design patterns correctly
* Think about scalability/maintainability

You are NOT expected to build production systems.

---

# Phase 1 — Master TypeScript for LLD

Before LLD, be very comfortable with these TS concepts.

## Topics

### Classes & Objects

```ts
class User {
  constructor(public name: string) {}
}
```

### Access Modifiers

```ts
private
protected
public
readonly
```

### Interfaces

```ts
interface PaymentMethod {
  pay(amount: number): void;
}
```

### Abstract Classes

```ts
abstract class Animal {
  abstract speak(): void;
}
```

### Inheritance

```ts
class Dog extends Animal {}
```

### Polymorphism

### Composition vs Inheritance

### Generics

```ts
class Repository<T> {}
```

### Static Members

### Enums

### Utility Types

```ts
Partial<T>
Pick<T>
Omit<T>
Record<K, V>
```

### Dependency Injection Basics

---

# Phase 2 — OOP Fundamentals (VERY IMPORTANT)

This is the foundation of LLD.

## 1. SOLID Principles

You MUST know these deeply.

### S — Single Responsibility Principle

### O — Open/Closed Principle

### L — Liskov Substitution Principle

### I — Interface Segregation Principle

### D — Dependency Inversion Principle

Practice identifying:

* violations
* refactoring
* good abstractions

---

## 2. Core OOP Concepts

* Encapsulation
* Abstraction
* Inheritance
* Polymorphism

---

## 3. Composition vs Inheritance

This is asked indirectly in interviews often.

Understand:

* when inheritance becomes rigid
* why composition is preferred

---

# Phase 3 — UML & Design Basics

You don’t need to become a UML expert.

Just know:

* Class diagrams
* Associations
* Aggregation
* Composition
* Dependency

Learn how to convert requirements into entities.

---

# Phase 4 — Design Patterns (CORE OF LLD)

This is the most important section.

---

# Step 1 — Start with Creational Patterns

## Singleton

Use cases:

* logger
* config manager

## Factory Method

VERY common in interviews.

Example:

```ts
PaymentFactory.create("UPI")
```

## Abstract Factory

## Builder

Useful for complex object creation.

## Prototype

---

# Step 2 — Structural Patterns

## Adapter

## Decorator

VERY important.

## Facade

## Composite

## Proxy

---

# Step 3 — Behavioral Patterns

## Strategy

Most important pattern.

```ts
paymentStrategy.pay()
```

## Observer

VERY common.

Used in:

* notifications
* event systems

## State

Great for machine/workflow questions.

## Command

## Chain of Responsibility

## Iterator

## Template Method

---

# BEST WAY TO LEARN PATTERNS

For each pattern:

1. Problem
2. Bad solution
3. Why it fails
4. Pattern solution
5. TypeScript implementation
6. Real-world use case

---

# Phase 5 — Learn Clean Code

Read:

## Clean Code

Important topics:

* naming
* small functions
* separation of concerns
* avoiding god classes
* avoiding tight coupling

---

# Phase 6 — Learn Refactoring

Read:

## Refactoring

Learn:

* code smells
* removing duplication
* extracting interfaces
* improving extensibility

---

# Phase 7 — Practice Core LLD Problems

NOW start interview problems.

---

# Beginner Problems

## 1. Parking Lot System

MOST common starter.

Learn:

* entities
* enums
* strategy pattern

---

## 2. Library Management System

---

## 3. Movie Ticket Booking

---

## 4. Elevator System

---

## 5. ATM Machine

Great for:

* state pattern
* chain of responsibility

---

## 6. Snake & Ladder

---

## 7. Tic Tac Toe

---

## 8. Coffee Vending Machine

Great for:

* decorators
* composition

---

# Intermediate Problems

## 1. Splitwise

VERY important.

Learn:

* domain modeling
* extensibility

---

## 2. Cab Booking (Uber/Ola)

---

## 3. Food Delivery (Swiggy/Zomato)

---

## 4. Cricbuzz System

---

## 5. Chess Game

---

## 6. Notification Service

Excellent for:

* observer pattern
* strategy pattern

---

## 7. File System

---

# Advanced Problems

## 1. Rate Limiter

## 2. Logger Framework

## 3. Cache System

## 4. Kafka-like Queue

## 5. Job Scheduler

---

# Phase 8 — Learn How to Approach Interviews

This matters more than code sometimes.

---

# Interview Framework

## Step 1 — Clarify Requirements

Ask:

* functional requirements
* edge cases
* assumptions

---

## Step 2 — Identify Core Entities

Example:

```txt
User
Booking
Payment
Vehicle
```

---

## Step 3 — Define Relationships

---

## Step 4 — Create Interfaces

---

## Step 5 — Add Extensibility

Interviewers LOVE this.

Example:

```txt
Future payment methods
Future vehicle types
Future notification channels
```

---

## Step 6 — Apply Patterns

Don’t force patterns.

Use them naturally.

---

## Step 7 — Write Clean Code

* modular
* readable
* extensible

---

# Recommended Learning Order

```txt
TypeScript Advanced
→ OOP
→ SOLID
→ UML Basics
→ Design Patterns
→ Clean Code
→ Refactoring
→ Beginner LLD Problems
→ Intermediate LLD Problems
→ Mock Interviews
```

---

# Best Resources

## YouTube

### Gaurav Sen

Best for interview mindset.

### Kunal Kushwaha

### Arpit Bhayani

---

# Websites

## [Refactoring Guru](https://refactoring.guru/?utm_source=chatgpt.com)

BEST for design patterns.

## [SourceMaking](https://sourcemaking.com/?utm_source=chatgpt.com)

## [GeeksforGeeks LLD](https://www.geeksforgeeks.org/system-design/lld-design-patterns/?utm_source=chatgpt.com)

---

# Best Practice Strategy

For EVERY problem:

## First

Draw:

* entities
* relationships
* responsibilities

---

## Then

Write:

```txt
interfaces
abstract classes
core services
```

---

## Then

Implement:

```txt
happy path
extensibility
patterns
```

---

# Your Best Stack for Practice

Use:

```txt
TypeScript
Node.js
ts-node
```

Folder structure:

```txt
src/
  models/
  interfaces/
  services/
  strategies/
  factories/
```

---

# 8-Week Practical Roadmap

## Week 1

* Advanced TypeScript
* OOP basics

---

## Week 2

* SOLID principles
* Composition vs inheritance

---

## Week 3

* Creational patterns

---

## Week 4

* Structural + behavioral patterns

---

## Week 5

* Clean Code
* Refactoring

---

## Week 6

* Beginner LLD problems

---

## Week 7

* Intermediate systems

---

## Week 8

* Timed mock interviews

---

# What Interviewers Actually Want

They care about:

* thought process
* abstractions
* clean interfaces
* extensibility
* tradeoffs

NOT:

* perfect code
* syntax memorization
* advanced algorithms

---

# Final Advice

The fastest way to improve:

1. Learn one pattern
2. Build one mini project using it
3. Solve one LLD problem
4. Refactor it
5. Explain your design aloud

That loop improves interview performance extremely fast.

A very effective next step for you would be:

* Parking Lot
* Splitwise
* Notification System
* Elevator System
* Logger Framework

Those 5 cover most important interview concepts.
