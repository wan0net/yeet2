# yeet2 Brain

Orchestration service for yeet2 planning.

## Runtime

Brain is meant to run from the repo's standard local surface:

- `pnpm dev:brain` from the repo root
- `PYTHONPATH=src python3 -m yeet2_brain` from `apps/brain`

It reads its bind address from repo-level env vars, preferring `YEET2_HOST` and `BRAIN_PORT`, with common fallbacks like `HOST` and `PORT` when present.

## Planner selection

Brain keeps the existing HTTP contract stable and can choose between two planning paths:

- `deterministic` for the built-in rule-based planner
- `crewai` for the CrewAI-backed planner

Selection is controlled with `YEET2_BRAIN_PLANNER_BACKEND`:

- `auto` picks CrewAI when it is installed and configured, otherwise it falls back to deterministic planning
- `crewai` forces the CrewAI path, but still falls back to deterministic planning if CrewAI fails at runtime
- `deterministic` disables CrewAI completely

## Enabling CrewAI

1. Install the optional extra for the Brain package, for example `pip install -e apps/brain[crewai]`.
2. Set `YEET2_BRAIN_PLANNER_BACKEND=crewai` or leave it on `auto`.
3. Set `YEET2_BRAIN_CREWAI_MODEL` to the model name you want CrewAI to use.
4. Provide the provider credentials required by that model, such as `OPENAI_API_KEY` for OpenAI-backed models.

Useful environment variables:

- `YEET2_BRAIN_CREWAI_ENABLED=1` enables CrewAI in `auto` mode without forcing the backend name
- `YEET2_BRAIN_CREWAI_MODEL=gpt-4o-mini` sets the CrewAI LLM model explicitly

If CrewAI is not installed, not configured, or raises an error, Brain automatically falls back to the deterministic planner and keeps serving the same mission/tasks/themes/summary response shape.
