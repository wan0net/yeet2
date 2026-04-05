-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ConstitutionStatus" AS ENUM ('pending', 'parsed', 'stale', 'failed');

-- CreateEnum
CREATE TYPE "ConstitutionParseStatus" AS ENUM ('pending', 'parsed', 'stale', 'failed');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ProjectAutonomyMode" AS ENUM ('manual', 'supervised', 'autonomous');

-- CreateEnum
CREATE TYPE "ProjectPullRequestMode" AS ENUM ('manual', 'after_implementer', 'after_reviewer');

-- CreateEnum
CREATE TYPE "ProjectPullRequestDraftMode" AS ENUM ('draft', 'ready');

-- CreateEnum
CREATE TYPE "ProjectMergeApprovalMode" AS ENUM ('human_approval', 'agent_signoff', 'no_approval');

-- CreateEnum
CREATE TYPE "ProjectBranchCleanupMode" AS ENUM ('manual', 'after_merge');

-- CreateEnum
CREATE TYPE "ProjectBranchCleanupState" AS ENUM ('pending', 'deleted', 'retained', 'failed');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('online', 'busy', 'offline');

-- CreateEnum
CREATE TYPE "ProjectRoleKey" AS ENUM ('planner', 'architect', 'implementer', 'tester', 'coder', 'qa', 'reviewer', 'visual');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('planned', 'active', 'complete', 'blocked');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'ready', 'running', 'complete', 'failed', 'blocked');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'complete', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_url" TEXT,
    "github_repo_owner" TEXT,
    "github_repo_name" TEXT,
    "github_repo_url" TEXT,
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "local_path" TEXT NOT NULL,
    "autonomy_mode" "ProjectAutonomyMode" NOT NULL DEFAULT 'manual',
    "pull_request_mode" "ProjectPullRequestMode" NOT NULL DEFAULT 'manual',
    "pull_request_draft_mode" "ProjectPullRequestDraftMode" NOT NULL DEFAULT 'draft',
    "merge_approval_mode" "ProjectMergeApprovalMode" NOT NULL DEFAULT 'human_approval',
    "branch_cleanup_mode" "ProjectBranchCleanupMode" NOT NULL DEFAULT 'manual',
    "last_autonomy_run_at" TIMESTAMP(3),
    "last_autonomy_status" TEXT,
    "last_autonomy_message" TEXT,
    "last_autonomy_actor" TEXT,
    "next_autonomy_run_at" TIMESTAMP(3),
    "constitution_status" "ConstitutionStatus" NOT NULL DEFAULT 'pending',
    "github_project_sync" BOOLEAN NOT NULL DEFAULT false,
    "github_project_node_id" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_role_definitions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role_key" "ProjectRoleKey" NOT NULL,
    "label" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "backstory" TEXT NOT NULL,
    "model" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_role_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_logs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "mission_id" TEXT,
    "task_id" TEXT,
    "job_id" TEXT,
    "blocker_id" TEXT,
    "kind" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constitutions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "vision_path" TEXT,
    "spec_path" TEXT,
    "roadmap_path" TEXT,
    "architecture_path" TEXT,
    "decisions_path" TEXT,
    "quality_bar_path" TEXT,
    "parse_status" "ConstitutionParseStatus" NOT NULL DEFAULT 'pending',
    "last_indexed_at" TIMESTAMP(3),

    CONSTRAINT "constitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'planned',
    "created_by" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "github_project_node_id" TEXT,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "agent_role" TEXT NOT NULL,
    "assigned_role_definition_id" TEXT,
    "assigned_role_definition_label" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "acceptance_criteria" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "blocker_reason" TEXT,
    "github_issue_number" INTEGER,
    "github_issue_node_id" TEXT,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "executor_type" TEXT NOT NULL,
    "worker_id" TEXT,
    "assigned_role_definition_id" TEXT,
    "assigned_role_definition_label" TEXT,
    "assigned_role_definition_model" TEXT,
    "workspace_path" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "github_compare_url" TEXT,
    "github_pr_number" INTEGER,
    "github_pr_url" TEXT,
    "github_pr_title" TEXT,
    "github_pr_state" TEXT,
    "github_pr_draft" BOOLEAN,
    "github_pr_merged_at" TIMESTAMP(3),
    "github_branch_cleanup_state" "ProjectBranchCleanupState" NOT NULL DEFAULT 'pending',
    "github_branch_deleted_at" TIMESTAMP(3),
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "log_path" TEXT,
    "artifact_summary" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "executor_type" TEXT NOT NULL,
    "status" "WorkerStatus" NOT NULL DEFAULT 'online',
    "capabilities" JSONB NOT NULL,
    "last_heartbeat_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "current_job_id" TEXT,
    "host" TEXT,
    "endpoint" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockers" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "recommendation" TEXT,
    "status" "BlockerStatus" NOT NULL DEFAULT 'open',
    "github_issue_number" INTEGER,
    "github_issue_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_local_path_key" ON "projects"("local_path");

-- CreateIndex
CREATE INDEX "project_role_definitions_project_id_sort_order_idx" ON "project_role_definitions"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "decision_logs_project_id_created_at_idx" ON "decision_logs"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "constitutions_project_id_key" ON "constitutions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "workers_name_executor_type_key" ON "workers"("name", "executor_type");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "project_role_definitions" ADD CONSTRAINT "project_role_definitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_logs" ADD CONSTRAINT "decision_logs_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "blockers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constitutions" ADD CONSTRAINT "constitutions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

