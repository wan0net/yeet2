# yeet2 Vision

## Mission

yeet2 is a self-hosted autonomous software factory.

An operator should be able to attach a repository, create human-readable GitHub tickets, and let yeet2 implement, validate, review, and close those tickets over time.

## Product Intent

yeet2 exists to reduce day-to-day micromanagement for technical operators while preserving durable project intent, traceability, and safety.

The system should:

- treat GitHub issues as the source of truth for work
- use project documents as reference context, not the primary work queue
- route work to specialist agents and capable workers
- persist decisions, artifacts, and blockers
- escalate to humans only when ambiguity, risk, or policy requires it

## Dogfood Direction

`forgeyard` is the internal dogfood expression of yeet2 itself.

In practice, that means yeet2 should be able to manage the yeet2 repository and progressively improve its own control plane, execution stack, and operating model.

## Operating Principles

- Control plane first, execution fabric second
- Durable missions and replayable state over ephemeral chat
- Replaceable orchestration and execution backends
- Safe isolated execution over direct mutation of `main`
- Human escalation as a deliberate policy surface, not the default workflow
