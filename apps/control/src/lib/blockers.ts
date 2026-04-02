import type { ProjectBlockerRecord, ProjectRecord, ProjectTaskRecord } from "./projects";

export interface ProjectBlockerListItem {
  blocker: ProjectBlockerRecord;
  projectId: string;
  projectName: string;
  taskTitle: string | null;
}

export function isOpenBlocker(status: string): boolean {
  return status.trim().toLowerCase() === "open";
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

function blockerSortKey(blocker: ProjectBlockerRecord): string {
  return blocker.createdAt ?? blocker.resolvedAt ?? "";
}

export function flattenProjectBlockers(projects: ProjectRecord[]): ProjectBlockerListItem[] {
  return projects
    .flatMap((project) =>
      project.blockers.map((blocker) => ({
        blocker,
        projectId: project.id,
        projectName: project.name,
        taskTitle: linkedTask(project, blocker)?.title ?? null
      }))
    )
    .sort((left, right) => {
      const leftOpen = isOpenBlocker(left.blocker.status);
      const rightOpen = isOpenBlocker(right.blocker.status);

      if (leftOpen !== rightOpen) {
        return leftOpen ? -1 : 1;
      }

      return blockerSortKey(right.blocker).localeCompare(blockerSortKey(left.blocker));
    });
}
