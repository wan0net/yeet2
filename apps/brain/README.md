# yeet2 Brain

Orchestration service for yeet2 planning.

## Runtime

Brain is meant to run from the repo's standard local surface:

- `pnpm dev:brain` from the repo root
- `PYTHONPATH=src .venv/bin/python -m yeet2_brain` from `apps/brain`

It reads its bind address from repo-level env vars, preferring `YEET2_HOST` and `BRAIN_PORT`, with common fallbacks like `HOST` and `PORT` when present.

For the common local path, Brain also keeps CrewAI runtime state under `apps/brain` by default:

- `HOME=apps/brain/.home`
- `CREWAI_STORAGE_DIR=apps/brain/.crewai-data`
- `CREWAI_DISABLE_TELEMETRY=true`

`pnpm dev:brain` works with those repo-local defaults and does not require manual `HOME` or `CREWAI_STORAGE_DIR` setup.

## Planner selection

Brain keeps the existing HTTP contract stable and can choose between two planning paths:

- `deterministic` for the built-in rule-based planner
- `crewai` for the CrewAI-backed planner

Selection is controlled with `YEET2_BRAIN_PLANNER_BACKEND`:

- `auto` picks CrewAI when it is installed and configured, otherwise it falls back to deterministic planning
- `crewai` forces the CrewAI path, but still falls back to deterministic planning if CrewAI fails at runtime
- `deterministic` disables CrewAI completely

## Enabling CrewAI

1. Create the dedicated Brain virtualenv: `uv venv apps/brain/.venv --python 3.12`.
2. Install the Brain package with the CrewAI extra: `uv pip install --python apps/brain/.venv/bin/python -e 'apps/brain[crewai]'`.
3. Start Brain with `pnpm dev:brain` or `cd apps/brain && PYTHONPATH=src .venv/bin/python -m yeet2_brain`.
4. Set `YEET2_BRAIN_PLANNER_BACKEND=crewai` or leave it on `auto`.
5. Set `YEET2_BRAIN_CREWAI_MODEL` to the model name you want CrewAI to use.
6. Provide the provider credentials required by that model, such as `OPENAI_API_KEY` for OpenAI-backed models.

Useful environment variables:

- `YEET2_BRAIN_CREWAI_ENABLED=1` enables CrewAI in `auto` mode without forcing the backend name
- `YEET2_BRAIN_CREWAI_MODEL=gpt-4o-mini` sets the CrewAI LLM model explicitly
- `CREWAI_STORAGE_DIR=/absolute/path` overrides the default repo-local CrewAI state directory when needed
- `HOME=/absolute/path` overrides the default repo-local home directory when needed

If CrewAI is not installed, not configured, or raises an error, Brain automatically falls back to the deterministic planner and keeps serving the same mission/tasks/themes/summary response shape.
