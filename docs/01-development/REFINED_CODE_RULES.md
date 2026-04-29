# Refined Code Rules
## Universal Best Practices for Professional Backend Development

### Core Philosophy

**Build complete domain modules, not isolated endpoints.**

Every significant feature must be delivered as a vertical slice:
1. Schema / migration
2. Entity + constants + types + DTOs
3. Service (business rules + orchestration)
4. Controller (thin boundary)
5. Integrations (queue, webhook, cache if needed)
6. Tests that lock behavior

Never ship “just an API”. Ship a cohesive, production-ready business capability.

### 1. Layer Responsibilities (Strict Boundaries)

#### Controllers — The Thin Boundary Layer
Controllers must remain extremely thin. They are allowed to do only four things:

- Define routes and versioning
- Enforce audience boundaries (`admin` / `user` / `public` / `internal`)
- Attach validation, serialization, and auth decorators
- Delegate to service and return result

**Forbidden in controllers:**
- Business branching
- Complex queries
- Side-effect decisions
- Manual data patching

If a controller method exceeds ~15–20 lines of actual logic, the logic is in the wrong place.

#### Services — The True Orchestration Layer
Services own:
- All business rules and invariants
- Coordination across multiple services
- Transaction management
- Queue / event / webhook orchestration
- Deep validation and side effects

**Rule:** When a service grows too large, extract a subdomain or dedicated helper — do not let it become a mega-service.

### 2. File Organization & Naming Discipline

Every module must follow the same shape:

```
feature/
├── feature.entity.ts
├── feature.service.ts
├── feature.v1.controller.ts          # or .v1.admin.controller.ts
├── feature.v1.internal.controller.ts
├── dtos/
│   ├── create-feature.dto.ts
│   └── ...
├── constants/
├── types/
├── enums/
└── index.ts
```

**Mandatory conventions:**
- Use `feature.v1.controller.ts` (never mix `user.controller.ts` / `users.controller.ts` / `user.controller.v1.ts`)
- Every module exports a clean public API via `index.ts`
- Import order (enforced):
  1. Node builtins
  2. External packages
  3. Internal aliases (`#src/...`)
  4. Local files
- Use `type` imports when only types are needed

### 3. Data Layer First — The Highest Leverage Optimization

When performance or complexity appears:

**Do this first:**
- Add database indexes
- Create or improve database Views
- Use `QueryBuilder` + `Brackets` + proper operators (`In`, `Not`, `MoreThanOrEqual`…)
- Introduce caching for hot lookups (tokens, frequent reads)
- Optimize foreign-key strategy and query shape

**Never do this:**
- Force a complex query into a repository method “to keep it clean”
- Micro-optimize TypeScript code while the query plan is terrible

Schema, entity, and service must evolve together. Never leave the codebase in a state where migration exists but entity is outdated, or service uses `as any`.

### 4. Error Handling — Domain Codes, Not Strings

- Use a consistent, small set of domain error codes (e.g., `DomainError.*`)
- Fail fast with clear, traceable errors
- Never throw generic `BadRequestException("something wrong")` scattered everywhere
- Internal helpers may throw plain `Error` for invariants — domain-facing errors must be typed

### 5. Structured Logging

- Log objects, never string concatenation
- Every log line must contain enough context to debug production
- HTTP middleware logs request + response + timing
- Enrich errors (Axios, deployment metadata, correlation IDs)

Logging exists for operations, not for casual reading.

### 6. Versioning & Surface Separation

When behavior diverges, split the surface — do not add branching inside one controller.

Preferred pattern:
- `feature.v1.controller.ts`
- `feature.v1.admin.controller.ts`
- `feature.v1.internal.controller.ts`
- `feature.v2.controller.ts`

Complexity is managed by surface area, not by comments.

### 7. Testing — Behavior-First, Edge-Case-Heavy

**Test structure (repeatable pattern):**
```ts
describe('FeatureService', () => {
  describe('create', () => {
    it('should create ... when valid input', () => {});
    it('should throw ... when duplicate', () => {});
    it('should ... edge case', () => {});
  });
});
```

**Key principles:**
- Test names describe behavior, not method names
- Shared factories are mandatory (produce valid default graphs; override only what matters)
- Service tests are semi-integration: real DB/repositories where possible, mock only external collaborators
- Prioritize: edge cases → state transitions → invariants → regressions → happy path
- Assertions are direct and pragmatic (`expect`, `jest.spyOn`, `rejects.toThrow`)

### 8. Refactoring Discipline

Refactor follows a strict rhythm:
**ship vertical slice → fix → refactor → perf/schema optimization**

Refactors are always:
- Incremental
- Targeted at real duplication or coupling
- Never “big rewrite for cleanliness”

Extract abstractions (decorators, helpers, base classes) **only after** real repeated pain has occurred. Premature abstraction is forbidden.

### 9. What to Abstract (Only After Pain)

High-value, battle-tested abstractions worth extracting:
- Repeated validation rules → decorators (`ValidateBody`, `Field`, `CheckDBColumn`…)
- Repeated query patterns → `QueryBuilder` helpers or Views
- Common CRUD scaffolding → lightweight base service (only when 3+ modules need it)
- Caching of hot auth/user data
- Activity / audit logging groups

Do **not** create abstractions “because it looks cleaner”.

### 10. Universal PR / Feature Checklist

A change is considered “production-grade” only when every item below is true:

- [ ] Feature is treated as a full domain module with complete vertical slice
- [ ] Controller is thin boundary only (<20 lines logic)
- [ ] All core business rules live inside service(s)
- [ ] Repeated rules have been extracted to decorator / DTO / helper
- [ ] Complex queries are in the correct layer (QueryBuilder / View / index)
- [ ] Errors use clear domain taxonomy
- [ ] Logging contains production-debuggable context
- [ ] Tests lock critical edge cases and regressions
- [ ] Schema / migration / entity / code are perfectly in sync
- [ ] No unnecessary complexity from larger systems has been copied

### Final Principle

**Write every line of code as if you are building a production domain module that must run reliably for years — not as someone who is merely completing a ticket at the endpoint level.**

This is the distilled essence. Master these rules and your codebase will scale cleanly, debug easily, and remain maintainable for a long time.