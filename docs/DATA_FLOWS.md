# yeet2 Data Flows

## Overview

This document describes the key runtime flows in yeet2 as implemented today.

## 1. Project Registration

```mermaid
sequenceDiagram
    participant Operator
    participant Control
    participant API
    participant Repo
    participant Postgres

    Operator->>Control: Create project
    Control->>API: POST /projects
    API->>Repo: Clone repo or attach local path
    API->>API: Inspect constitution files
    API->>Postgres: Persist project + constitution status
    API-->>Control: Project summary
```

What is persisted:

- project metadata
- repo location
- constitution inspection state
- default role definitions

## 2. Planning Flow

```mermaid
sequenceDiagram
    participant Operator
    participant Control
    participant API
    participant Brain
    participant Postgres

    Operator->>Control: Plan now or start AI
    Control->>API: POST /projects/:id/plan
    API->>Postgres: Load project, constitution, history, guidance
    API->>Brain: Planning request
    Brain-->>API: Mission + task draft
    API->>Postgres: Persist mission + tasks + decision logs
    API-->>Control: Hydrated project state
```

Inputs used by planning:

- constitution documents
- mission/task history
- configured staff roles and models
- actionable targeted guidance from project chat

Outputs:

- mission
- task list
- planning provenance
- handoff message for the next role

## 3. Execution Flow

```mermaid
sequenceDiagram
    participant Control
    participant API
    participant Executor
    participant OpenHands
    participant Repo
    participant Postgres

    Control->>API: Dispatch task or run project
    API->>Postgres: Resolve next dispatchable task
    API->>Executor: POST /jobs
    Executor->>Repo: Create worktree / branch
    Executor->>OpenHands: Run task in isolated workspace
    Executor-->>API: Job record
    API->>Postgres: Persist job + task state + logs metadata
    API->>Postgres: Persist working/handoff messages
```

Execution-side context includes:

- task details
- acceptance criteria
- targeted actionable guidance from project chat
- selected model for the assigned staff member

## 4. Job Refresh Flow

```mermaid
sequenceDiagram
    participant Control
    participant API
    participant Executor
    participant Postgres

    Control->>API: Refresh job or open job logs
    API->>Executor: Read latest job state
    Executor-->>API: Current status/log/artifact info
    API->>Postgres: Reconcile job + task state
    API-->>Control: Updated job summary
```

This keeps the control plane durable even when execution runs asynchronously.

## 5. Approval And Blocker Flow

```mermaid
sequenceDiagram
    participant API
    participant Postgres
    participant Control
    participant Operator
    participant GitHub

    API->>Postgres: Create blocker
    API->>GitHub: Optional issue or PR metadata update
    Postgres-->>Control: Blocker visible in queues
    Operator->>Control: Approve or reject
    Control->>API: POST blocker approval action
    API->>Postgres: Resolve/dismiss blocker, update task state
    API->>GitHub: Optional merge or refresh
```

Tickets are the main human escalation surface.

## 6. Project Chat Flow

```mermaid
sequenceDiagram
    participant Operator
    participant AgentA as Agent
    participant API
    participant Postgres
    participant AgentB as Next agent

    Operator->>API: Post message
    AgentA->>API: Emit working update or handoff
    API->>Postgres: Store message as decision log
    Postgres-->>API: Durable chat history
    API->>AgentB: Include actionable targeted messages in next planning/dispatch context
```

Important rules:

- chat is durable in Postgres
- targeted messages can drive action
- broadcasts are visible but not automatically actionable
- replies inherit target context when no new mention is added

## 7. GitHub Artifact Flow

```mermaid
flowchart LR
    Task["Task"] --> Job["Job branch/worktree"]
    Job --> PR["GitHub PR"]
    PR --> Review["Reviewer / human approval"]
    Review --> Merge["Merge decision"]
    Merge --> Cleanup["Branch cleanup policy"]
    Cleanup --> Postgres["Persisted lifecycle state"]
```

Persisted GitHub metadata includes:

- repo metadata
- compare links
- PR number/url/title/state
- merge state
- branch cleanup state

## 8. Autonomy Loop

```mermaid
flowchart TD
    Tick["Autonomy loop tick"] --> Refresh["Refresh active jobs and PR state"]
    Refresh --> Assess["Assess blockers, approvals, next work"]
    Assess -->|No mission| Plan["Plan mission"]
    Assess -->|Dispatchable task| Dispatch["Dispatch next task"]
    Assess -->|Blocked human review| Wait["Wait for operator input"]
    Plan --> Persist["Persist mission/tasks/messages"]
    Dispatch --> Persist
    Persist --> Next["Schedule next run"]
```

The loop is intentionally conservative:

- it does not hide Brain failures
- it respects approval and merge policy
- it uses durable project state rather than transient session context
