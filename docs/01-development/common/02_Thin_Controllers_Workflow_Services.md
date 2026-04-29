# Skill 02: Thin Controllers + Workflow Services

## Goal
Enforce strict layer boundaries so controllers stay dumb and services become powerful workflow orchestrators.

## Controller Rules (Non-Negotiable)
A controller method is allowed **only** these 4 responsibilities:

1. Route definition + versioning
2. Audience boundary enforcement (`admin`/`user`/`public`/`internal`)
3. Attach decorators (validation, auth, serialization)
4. Delegate to service and return result

**Maximum ~15–20 lines of real logic.**  
Anything more → move to service.

**Forbidden in controllers:**
- Business branching or decisions
- Complex queries or data shaping
- Side effects or transaction management
- Manual patching or transformation

## Service Rules — The Workflow Orchestrator
Services must own the **complete operational flow**:

- Early guard clauses (fail fast with domain errors)
- Parallel dependency fetching when possible
- External integration calls
- State persistence + side effects
- `runInTransaction` for critical sections
- `upsert` + unique indexes for invariants
- Structured checkpoint logging
- Clean result or typed domain error

**When a workflow grows large** (mobile crypto, queue processing, webhook handling, etc.) → extract to its own bounded module immediately.

## Practical Test
Open any controller file:
- Count lines of actual logic (ignore decorators)
- If > 20 lines → violation
- Can you explain the full workflow just by reading the service? If not → service is incomplete

## Success Signal
A new developer can read the service and immediately understand the entire business process, including what happens on failure and how to retry.