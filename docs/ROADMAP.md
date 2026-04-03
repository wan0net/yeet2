# yeet2 Roadmap

## Milestone 1: System Skeleton

- establish the pnpm monorepo
- boot Control, API, Brain, and Executor services
- create the initial database schema
- provide health endpoints
- ship a minimal control shell

## Milestone 2: Project Registration

- register projects from local attachment or repository clone
- detect constitution files
- persist constitution status
- expose project status in the UI

## Milestone 3: Planning Loop

- parse constitution files
- create an initial mission
- generate at least three concrete tasks
- persist and render the resulting work

## Milestone 4: Execution Loop

- dispatch implementation work through the executor
- run implementation in isolated branches or workspaces
- capture logs and artifacts
- persist job state and worker linkage

## Milestone 5: QA And Review

- run QA and reviewer stages
- support blocker creation and resolution
- surface approvals and escalation in the control UI
- record outcomes against jobs, tasks, and missions

## Milestone 6: Dogfood On forgeyard

- deploy yeet2 to `10.42.10.101`
- register the yeet2 repository as `forgeyard`
- ingest the constitution from the repo itself
- run planning and at least one real autonomous work cycle
- use the hosted instance to continue developing yeet2

## Next Horizon

- strengthen execution sandboxing with ASRT or sharkcage-backed policy
- expand continuous autonomy and backlog refresh behavior
- deepen GitHub-native PR, review, and merge automation
- evolve the local fabric into a Nomad-backed distributed execution layer
