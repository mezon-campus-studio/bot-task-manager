# Skill 03: Durability & Idempotency Engineering

## Goal

Turn unreliable external/async flows (webhooks, queues, mobile callbacks, third-party providers) into **inspectable, retryable, fixable internal state machines**.

## Mandatory Pattern for Any Async/External Flow

### 1. Persist First, Then Act

- Create DB record **before** enqueue
- On webhook receipt → immediately persist payload + reference
- Never process purely in-memory for business-critical flows

### 2. Idempotency Guards (Always)

- Unique index on every external reference (providerRef, quoteId, txHash, etc.)
- Use `upsert()` / `orUpdate()` / `onConflict` instead of plain `create`
- Make every handler safe to replay

### 3. State Machine Thinking

Every workflow must have explicit states that are:

- Stored in DB
- Logged at every transition
- Queryable by operators

### 4. Retry & Recovery Paths

- Design explicit retry mechanisms
- Never rely on queue vendor alone for durability
- Add dead-letter or manual reprocess endpoints when needed

## Examples of Correct Application

- Crypto deposit webhook → create transaction record + unique provider ref → process
- Queue job → create job record in DB → enqueue reference → process with status tracking
- Mobile withdrawal → persist quote + unique id → call provider → update state atomically

## Anti-Pattern

```ts
// BAD
await queue.add('processWithdrawal', data); // no DB record, no idempotency
```
