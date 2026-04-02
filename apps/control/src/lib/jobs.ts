import type { ProjectJobRecord, ProjectMissionRecord, ProjectRecord, ProjectTaskRecord } from "./projects";

export interface FlattenedProjectJob {
  project: Pick<ProjectRecord, "id" | "name" | "localPath" | "repoUrl" | "defaultBranch">;
  mission: Pick<ProjectMissionRecord, "id" | "title"> | null;
  task: Pick<ProjectTaskRecord, "id" | "title" | "agentRole" | "status"> | null;
  job: ProjectJobRecord;
  sortTimestamp: number;
}

function timestampValue(...values: Array<string | null | undefined>): number {
  for (const value of values) {
    if (!value) {
      continue;
    }

    const parsed = new Date(value).getTime();
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function flattenProjectJobs(projects: ProjectRecord[]): FlattenedProjectJob[] {
  return projects
    .flatMap((project) =>
      project.missions.flatMap((mission) =>
        mission.tasks.flatMap((task) =>
          task.jobs.map((job) => ({
            project: {
              id: project.id,
              name: project.name,
              localPath: project.localPath,
              repoUrl: project.repoUrl,
              defaultBranch: project.defaultBranch
            },
            mission: {
              id: mission.id,
              title: mission.title
            },
            task: {
              id: task.id,
              title: task.title,
              agentRole: task.agentRole,
              status: task.status
            },
            job,
            sortTimestamp: timestampValue(job.completedAt, job.startedAt)
          }))
        )
      )
    )
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp);
}
