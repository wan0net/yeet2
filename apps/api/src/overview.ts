import type { ControlPlaneOverview } from "@yeet2/domain";

import { describeApiAuth } from "./auth";
import { listProjectApprovals, listRegisteredProjects, listGlobalJobs } from "./projects";
import { summarizeWorkerFleet } from "./workers";

export async function buildControlPlaneOverview(): Promise<ControlPlaneOverview> {
  const [projects, approvals, jobs, workers] = await Promise.all([
    listRegisteredProjects(),
    listProjectApprovals({ status: "open" }),
    listGlobalJobs({ status: "all" }),
    summarizeWorkerFleet()
  ]);

  const totals = projects.projects.reduce(
    (summary, project) => {
      summary.projects += 1;
      summary.activeMissions += project.activeMissionCount;
      summary.activeTasks += project.activeTaskCount;
      summary.openBlockers += project.blockerCount;
      return summary;
    },
    {
      projects: 0,
      activeMissions: 0,
      activeTasks: 0,
      openBlockers: 0
    }
  );

  const runningJobs = jobs.jobs.filter((entry) => entry.job.status === "running").length;
  const queuedJobs = jobs.jobs.filter((entry) => entry.job.status === "queued").length;
  const failedJobs = jobs.jobs.filter((entry) => entry.job.status === "failed").length;

  return {
    generatedAt: new Date().toISOString(),
    auth: describeApiAuth(),
    totals: {
      ...totals,
      openApprovals: approvals.approvals.length,
      runningJobs,
      queuedJobs,
      failedJobs
    },
    workers
  };
}

