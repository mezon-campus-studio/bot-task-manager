# Skill 01: Workflow-First Mindset

## Goal
Stop thinking in "endpoints" or "CRUD". Start thinking in **production workflows** that must survive retries, failures, external systems, and operator intervention.

## Core Principle
**Every feature is a durable, observable workflow — not a function.**

## Key Rules

### 1. Vertical Slice Delivery (Mandatory)
For any non-trivial feature, deliver **all** of these together in one coherent change:
- Schema / migration
- Entity + DTOs + types
- Service that owns the full flow
- Thin controller
- Persisted state (if async/external)
- Idempotency guards
- Operator surface (if needed)
- Tests for scenarios + failure modes

### 2. Delivery Rhythm
Preferred rhythm:
**feat (working vertical slice) → quick fixes → refactor (boundary move) → test hardening → polish**

- Ship something real early
- Harden immediately when holes appear
- Move code to correct module as soon as mental model clarifies

### 3. Ask These Questions Before Coding
- What external events or async steps does this flow have?
- Where will state live so we can retry/inspect/fix?
- Who (operator/support) needs visibility or control?
- What are the realistic failure modes in production?


## Anti-Patterns to Kill
- "I'll just add an endpoint first, then figure out the rest later"
- Treating queue/webhook/mobile flow as "someone else's problem"
- Leaving async paths without persisted state

## Success Signal
When you look at a feature, you can clearly draw the **state machine** and point to where every external event lands and how it is made durable.