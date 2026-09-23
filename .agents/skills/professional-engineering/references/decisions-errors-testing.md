# Decisions, Errors, and Tests

## Decisions and actions

A decision answers what should happen: eligibility, permission, pricing, routing, retry, or transition validity. An action changes the outside world: persistence, HTTP, payment, email, queueing, filesystem, or analytics.

Extract a decision when its policy has several branches, business consequences, likely change, or a useful test matrix. The result should explain the outcome in domain terms—for example, an allowed flag with a reason/code or a transition result—not merely return an opaque boolean when callers need to know why.

Then orchestrate effects in the caller using that decision. Maintain the existing project's transactional, retry, and error-handling conventions. Do not extract a three-line rule solely to create a named function.

## Failure design

Use the repository's error model. Where an error crosses a programmatic boundary, provide a stable code; keep prose for humans. Add structured, safe details only when they help callers correct the request or operators diagnose the incident.

For important operations, preserve correlation identifiers or other safe diagnostic context already used by the system. Logs should state the operation and relevant identifiers, but must not contain passwords, access tokens, secrets, payment credentials, private keys, or unnecessary personal data.

Never make control flow depend on parsing human-facing error text when a typed error or code can be used.

## Risk-based tests

Test behavior that is costly to break, rather than chasing coverage.

- Unit-test business decisions, validation, calculations, permission checks, retries, and state transitions.
- Test adapters/mappers when external input changes internal behavior.
- Test API error codes when clients depend on them.
- Use integration tests when correctness depends on components working together, transactions, serialization, or real infrastructure behavior.

Favor examples around boundaries: allowed and rejected decisions, valid and invalid transitions, provider success and failure shapes, and idempotency/concurrency cases where relevant. Match the project's test style and run the narrowest relevant checks first.
