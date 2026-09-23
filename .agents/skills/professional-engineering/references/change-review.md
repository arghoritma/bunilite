# Change Review

## Change discipline

Review the diff as a reader who did not author it. Confirm that the behavior change is identifiable and that unrelated formatting, refactoring, renaming, generated files, or configuration churn is absent or justified.

When a task has several concerns, keep logical separation even if the delivery must be one change. For example, distinguish a no-behavior structural cleanup from a policy change, provider integration, consumer update, or migration. Do not force separate commits or pull requests unless the user or repository workflow asks for them.

## Review prompts

- Is the intended success path and each material failure path obvious?
- Could a future reader infer why a condition, default, or transition exists?
- Did external vocabulary leak past the appropriate boundary?
- Does a new abstraction reduce concrete coupling or merely move code around?
- Are changed contracts, configuration, migrations, retries, and rollback consequences visible?
- Do tests prove the changed behavior at the right level?
- Can the change be reverted without leaving data or callers in an incoherent state?

## Trade-offs

Prioritize correctness, then clarity and safety, followed by testability, maintainability, repository consistency, and measured performance needs. Cleverness is not a goal. A real latency, cost, or scale constraint may change the trade-off; state it briefly when it materially affects the design.

Leave the local code easier to reason about than before, but do not expand a narrow request into a cleanup campaign.
