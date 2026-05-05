# Skill 04: Early Guard Clauses + Operational Logging + Operator Surfaces

## Part A: Early Guard Clauses (Defensive Programming)

### Rule

**Validate and reject before doing any work.**

Every service method should start with a block of guard clauses:

```ts
if (!user.isVerified) throw new DomainError.UserNotVerified();
if (!supportedCurrencies.includes(currency)) throw new DomainError.UnsupportedCurrency();
if (!wallet) throw new DomainError.WalletNotFound();
if (wallet.status !== 'VERIFIED') throw new DomainError.WalletNotVerified();
if (balance < amount) throw new DomainError.InsufficientBalance();
```

**Benefits:**

- Fail fast → clear domain errors
- Easy to test
- Prevents partial state corruption
- Makes logs and metrics much cleaner

## Part B: Structured Operational Logging

### Rule

Log **at every meaningful checkpoint** with structured objects.

Good pattern:

```ts
logger.log({
  step: 'attempting_provider_call',
  flow: 'crypto_withdrawal',
  quoteId,
  userId,
  amount,
});

logger.log({
  step: 'provider_response_received',
  result: response.status,
  providerRef: response.data.id,
});
```

**Never** log long strings or sensitive data.  
Log enough context to answer "what happened at 3 a.m.?" without reading code.

## Part C: Operator & Admin Surfaces

### Rule

If a flow can fail, backlog, or need manual intervention → give operators a way to see and act.

**Always consider adding:**

- Internal/admin controller endpoints
- Queue status / pause / resume / alert thresholds
- Retry / reprocess endpoints
- Views or lists showing workflow state

**Example:** A queue module should have:

- `GET /internal/queue/status`
- `POST /internal/queue/pause`
- `POST /internal/queue/retry-failed`

## Success Signal

- A support engineer can diagnose a stuck flow in <2 minutes using logs + admin endpoints
- No "black box" async processes that only the original author understands
