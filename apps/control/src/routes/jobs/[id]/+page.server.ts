import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadGlobalJob } from "$lib/server/control-data";
import { apiJson } from "$lib/server/api";
import { serverLogger } from "$lib/server/logger";

interface JobLogResponse {
  jobId: string;
  logPath: string | null;
  content: string;
  truncated: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
  const entry = await loadGlobalJob(params.id);
  if (!entry) {
    throw error(404, "Job not found");
  }

  let log: JobLogResponse | null = null;
  try {
    log = await apiJson<JobLogResponse>(`/projects/${entry.projectId}/jobs/${entry.job.id}/log`);
  } catch (logError) {
    // Log may not be available — surface as a warning so operators
    // can see when the executor is dropping log entries.
    serverLogger.loadFailure("jobs/[id]/log", logError, {
      projectId: entry.projectId,
      jobId: entry.job.id
    });
  }

  return {
    projectId: entry.projectId,
    projectName: entry.projectName,
    missionId: entry.missionId,
    missionTitle: entry.missionTitle,
    taskId: entry.taskId,
    taskTitle: entry.taskTitle,
    taskRole: entry.taskAgentRole,
    job: entry.job,
    log
  };
};
