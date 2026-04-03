import { isOpenBlocker } from "./blockers";
import { projectGitHubRepoInfo, type ProjectBlockerRecord, type ProjectRecord, type ProjectTaskRecord } from "./projects";

export interface ProjectApprovalQueueItem {
  blocker: ProjectBlockerRecord;
  projectId: string;
  projectName: string;
  projectRepoUrl: string;
  projectGitHubWebUrl: string | null;
  taskTitle: string | null;
}

function linkedTask(project: ProjectRecord, blocker: ProjectBlockerRecord): ProjectTaskRecord | null {
  if (!blocker.taskId) {
    return null;
  }

  for (const mission of project.missions) {
    const match = mission.tasks.find((task) => task.id === blocker.taskId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function isHumanReviewApproval(blocker: ProjectBlockerRecord): boolean {
  return blocker.title.trim().toLowerCase().startsWith("human review required");
}

function approvalSortKey(blocker: ProjectBlockerRecord): string {
  return blocker.createdAt ?? blocker.resolvedAt ?? "";
}

export function flattenProjectApprovals(projects: ProjectRecord[]): ProjectApprovalQueueItem[] {
  return projects
    .flatMap((project) => {
      const githubRepo = projectGitHubRepoInfo(project);

      return project.blockers
        .filter(isHumanReviewApproval)
        .map((blocker) => ({
          blocker,
          projectId: project.id,
          projectName: project.name,
          projectRepoUrl: project.repoUrl,
          projectGitHubWebUrl: githubRepo?.webUrl ?? null,
          taskTitle: linkedTask(project, blocker)?.title ?? null
        }));
    })
    .sort((left, right) => {
      const leftOpen = isOpenBlocker(left.blocker.status);
      const rightOpen = isOpenBlocker(right.blocker.status);

      if (leftOpen !== rightOpen) {
        return leftOpen ? -1 : 1;
      }

      return approvalSortKey(right.blocker).localeCompare(approvalSortKey(left.blocker));
    });
}
