# Boundaries and State

## External boundaries

An external boundary translates a representation that the application does not own into one that it does. Sources include providers, SDKs, webhooks, database records, request/response objects, configuration, and message payloads.

Add a boundary when the external representation crosses multiple local areas, exposes provider-specific language to business logic, needs validation/defaulting, or is likely to change independently. A boundary can be a small parsing function beside the caller; it does not require a new architectural layer.

At the boundary:

1. Validate assumptions that matter to correctness.
2. Translate external names and sentinel values into internal terms.
3. Apply only documented, intentional defaults.
4. Return a stable internal value or a contextual failure.

Keep provider status strings, sparse payload semantics, and framework-specific types out of downstream decision code whenever practical. Test the mapping when a provider contract affects behavior.

## State modeling

Treat optional fields and free-form status strings as a signal to investigate, not an automatic defect. They are risky when different lifecycle stages have different required data or when callers repeatedly defend against impossible combinations.

Represent material distinctions explicitly:

- use a finite set for a known status domain;
- use separate input and persisted types when identity is absent before saving;
- use discriminated variants or a transition function when each state has different required fields;
- use runtime validation or constructors when static types cannot establish the invariant.

Make only meaningful invalid states difficult to represent. Preserve intentionally partial objects, patch inputs, and external payload types as such; validate them at the point where the application needs a complete internal value.

## Transition questions

For a stateful change, answer:

- Which states are allowed to enter this operation?
- What successful and failed states can result?
- What data is required in each state?
- Which transition needs idempotency, concurrency protection, or an audit trail?

Do not invent a state machine if a single validation rule communicates the invariant more clearly.
