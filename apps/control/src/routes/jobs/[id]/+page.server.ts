import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { loadProjects } from "$lib/server/control-data";
import { apiJson } from "$lib/server/api";
import { serverLogger } from "$lib/server/logger";

interface JobLogResponse {
  jobId: string;
  logPath: string | null;
  content: string;
  truncated: boolean;
}

export const load: PageServerLoad = async ({ params }) => {
  const projects = await loadProjects();

  for (const project of projects) {
    for (const mission of project.missions) {
      for (const task of mission.tasks) {
        const job = task.jobs.find((j) => j.id === params.id);
        if (job) {
          let log: JobLogResponse | null = null;
          try {
            log = await apiJson<JobLogResponse>(`/projects/${project.id}/jobs/${job.id}/log`);
          } catch (logError) {
            // Log may not be available — surface as a warning so operators
            // can see when the executor is dropping log entries.
            serverLogger.loadFailure("jobs/[id]/log", logError, {
              projectId: project.id,
              jobId: job.id
            });
          }

          return {
            projectId: project.id,
            projectName: project.name,
            missionId: mission.id,
            missionTitle: mission.title,
            taskId: task.id,
            taskTitle: task.title,
            taskRole: task.agentRole,
            job,
            log
          };
        }
      }
    }
  }

  throw error(404, "Job not found");
};
