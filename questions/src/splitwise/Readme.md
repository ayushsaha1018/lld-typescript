# Splitwise Low-Level Design (LLD)

This repository contains the Low-Level Design (LLD) for a Splitwise-like application. It demonstrates how to structure a complex system using object-oriented principles, design patterns, and efficient algorithms.

## 🗂️ High-Level Architecture at a Glance

```text
src/splitwise/
├── enums/          ← SplitType (EQUAL, PERCENTAGE)
├── model/          ← Pure data (User, Group, Expense, Split, BalanceSheet)
├── repository/     ← In-memory database (GroupRepository)
├── strategy/       ← Strategy Pattern: Split calculations (Equal, Percentage)
├── factory/        ← SplitStrategyFactory: Maps SplitType → Strategy
├── utils/          ← PriorityQueue: Custom max-heap for debt simplification
├── service/        ← Business logic (ExpenseService, BalanceSheetService, GroupService)
└── Main.ts         ← Entry / wiring
```

## 📝 Problem Statement

Splitwise is an application that allows users to share expenses with friends and family. The core functionalities required for this LLD are:
1. **User and Group Management**: Users can be part of multiple groups.
2. **Adding Expenses**: Users can add expenses within a group. An expense is paid by one user and split among multiple participants.
3. **Split Types**: The system should support different ways to split an expense:
   - **EQUAL**: Split the amount equally among all participants.
   - **PERCENTAGE**: Split the amount based on specific percentages.
4. **Balance Tracking**: The system must track how much each user owes to others and how much they are owed.
5. **Debt Simplification**: A feature to minimize the total number of transactions required to settle all debts within a group.

---

## 🏛️ Architecture & Components

The application is structured into several layers to ensure separation of concerns, scalability, and maintainability.

### 1. Models (Entities)
The core data structures that represent the business domain:
- **`User`**: Represents a system user with an ID and Name.
- **`Group`**: Represents a group of users. It holds the group's expenses, members, and a `BalanceSheet` for each member.
- **`Expense`**: Represents a single transaction. It contains the description, total amount, the user who paid (`paidBy`), a list of `Split` objects, and the `SplitType`.
- **`Split`**: Represents a single participant's share of an expense, linking a `User` to their calculated `amount`.
- **`BalanceSheet`**: Tracks the financial state of a single user within a group. It stores the total amount paid, total expense incurred, and a map of balances (who owes them, or who they owe).

> [!WARNING]
> **Design Smell — Floating Point Math**: In a real financial system, you would never use standard floating-point `number` for currency computations due to precision errors (e.g., 0.1 + 0.2 = 0.30000000000000004). You would use an integer representing cents/paise, or a specialized `Decimal` library. In an interview, mention this explicitly!

### 2. Services (Business Logic)
Services orchestrate the business rules and interactions between models:
- **`GroupService`**: The entry point for group operations. Handles creating groups, adding members, routing expense creation, and triggering debt simplification.
- **`ExpenseService`**: Responsible for taking an expense request, using the correct strategy to calculate splits, saving the expense, and calling the `BalanceSheetService` to update user balances.
- **`BalanceSheetService`**: Updates the `BalanceSheet` of the payer and all participants whenever a new expense is added.
- **`DebtSimplificationService`**: Contains the algorithmic logic to minimize the number of transactions needed to settle all debts in a group.

### 3. Repositories (Data Access)
- **`GroupRepository`**: An interface defining how groups are stored and retrieved.
- **`InMemoryGroupRepository`**: A concrete implementation using an in-memory `Map`. This allows the application to run without a database, but makes it easy to swap in a real database later.

---

## 🧩 Design Patterns Used

This LLD leverages several design patterns to make the code flexible and extensible:

### 1. Strategy Pattern
**Problem**: We have different ways to split an expense (Equal, Percentage, Exact, etc.), and putting all this logic in a massive `switch` statement inside the `ExpenseService` would violate the Open/Closed Principle.
**Solution**: We define a `SplitStrategy` interface with a `split()` method. We then create concrete classes (`EqualSplitStrategy`, `PercentageSplitStrategy`) that implement this interface. If we need to add a new split type (like "By Shares"), we simply create a new strategy class without modifying existing code.

### 2. Factory Pattern
**Problem**: How does the system decide which `SplitStrategy` to instantiate based on the user's input?
**Solution**: The `SplitStrategyFactory` takes a `SplitType` enum and returns the appropriate `SplitStrategy` instance. This abstracts the object creation logic away from the `ExpenseService`.

### 3. Dependency Injection
Services are injected into each other via constructors (e.g., `GroupService` receives `ExpenseService`, `DebtSimplificationService`, and `GroupRepository`). This makes the classes loosely coupled and highly testable.

---

## 🔄 Data Flow: Adding an Expense

When a user adds an expense, the data flows through the system as follows:

1. **Client Request**: `GroupService.addExpense()` is called with the amount, payer, participants, and split type.
2. **Delegation**: `GroupService` delegates the call to `ExpenseService.addExpense()`.
3. **Strategy Resolution**: `ExpenseService` asks the `SplitStrategyFactory` for the correct strategy based on the `SplitType`.
4. **Split Calculation**: The chosen strategy calculates the exact monetary amount each participant owes and returns a list of `Split` objects.
5. **Expense Creation**: An `Expense` object is created and added to the `Group`.
6. **Balance Update**: `BalanceSheetService.updateBalances()` is called. It iterates through the splits, updating the payer's total paid and adjusting the pairwise balances between the payer and every other participant.

---

## 🧮 Algorithm: Debt Simplification

The most complex part of Splitwise is **Debt Simplification** (minimizing the number of transactions). If A owes B $10, and B owes C $10, the system should simplify this so A pays C $10 directly, removing B from the middle.

### How it Works (Greedy Algorithm)
We use a greedy algorithm utilizing **Max-Heaps (Priority Queues)**.

1. **Calculate Net Balances**: 
   First, we calculate the absolute net balance for every user in the group. 
   - `Net Balance = (Total amount others owe me) - (Total amount I owe others)`
   - If Net Balance > 0, the user is a **Creditor** (they need to get money back).
   - If Net Balance < 0, the user is a **Debtor** (they need to pay money).

2. **Separate into Heaps**:
   - Push all Creditors into a `Max-Heap` (sorted descending by the amount they are owed).
   - Push all Debtors into another `Max-Heap` (sorted descending by the absolute amount they owe).

3. **Settle Debts**:
   - Pop the largest Creditor and the largest Debtor.
   - The amount settled is the `minimum` of what the Creditor is owed and what the Debtor owes (`Math.min(creditAmount, -debitAmount)`).
   - Record a transaction where the Debtor pays the Creditor this settled amount.
   - Deduct the settled amount from both their balances.
   - If the Creditor still has a positive balance, push them back into the Creditor heap.
   - If the Debtor still has a negative balance, push them back into the Debtor heap.
   - Repeat until both heaps are empty.

**Time Complexity**: `O(N log N)` where N is the number of users in the group, because inserting/extracting from a Priority Queue takes `O(log N)` time.

---

## 🔌 Extensibility Points — How to Extend This Design

### 1. Add an `EXACT` Split Type
1. Add `EXACT` to the `SplitType` enum.
2. Create `ExactSplitStrategy.ts` implementing `SplitStrategy` (validates sum of metadata amounts == total amount).
3. Add a case in `SplitStrategyFactory`.
**Zero changes to core logic.** ✅

### 2. Handle Rounding Errors (Cents Distribution)
When splitting $100 among 3 people equally, they get $33.33 each, leaving $0.01 unassigned.
**How to fix:** The `EqualSplitStrategy` should assign `$33.33` to everyone, calculate the remainder, and add the remaining `$0.01` to the first participant (or the payer) to ensure the splits perfectly sum to the total amount.

---

## 💬 Interview Talking Points Cheat Sheet

> **"What design patterns did you use?"**  
> Strategy for the splitting logic, Factory for instantiating the right strategy, and Repository for the database abstraction.

> **"Why use the Strategy pattern for splits?"**  
> It keeps the `ExpenseService` clean. If we didn't use it, we'd have a giant `switch` statement with complex math inside the service. With Strategy, adding a new split type (like "Shares" or "Exact") is trivial and doesn't risk breaking existing code.

> **"How does the Debt Simplification algorithm work?"**  
> It's a greedy algorithm using two Max-Heaps (Priority Queues). We calculate everyone's net balance. We put people who need money in the Creditor heap, and people who owe money in the Debtor heap. We repeatedly pop the largest creditor and largest debtor and settle the minimum of their balances until everyone is at $0.

> **"What are the edge cases in your code?"**  
> 1. **Floating-point precision** (using `number` instead of integers/cents).
> 2. **Uneven splits** causing a missing cent (e.g., $100 / 3).
> 3. **Concurrency**: If two users add an expense simultaneously in a real DB, we need row-level locking or optimistic concurrency control on the BalanceSheet to prevent race conditions.

> **"How would you scale this?"**  
> The `DebtSimplificationService` is computationally heavy. Instead of running it synchronously every time an expense is added, we could push an event to a queue (e.g., Kafka) and run debt simplification asynchronously in a background worker, updating the view-models when complete.

---

## 🚀 How to Run

To run the demonstration of this LLD:

```bash
# Execute the Main file using bun
bun Main.ts

# Or using Node.js with ts-node
npx ts-node Main.ts
```
