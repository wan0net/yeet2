// Shared mock data for E2E tests.
// Shapes match the API and domain types used by the control app.

export const mockProject = {
  id: "test-project-1",
  name: "Test Project",
  localPath: "/tmp/test-project",
  repoUrl: "https://github.com/test/repo",
  defaultBranch: "main",
  constitutionStatus: "parsed",
  constitution: {
    status: "parsed" as const,
    files: {
      vision: true,
      spec: true,
      roadmap: false,
      architecture: false,
      decisions: false,
      qualityBar: false,
    },
  },
  autonomy: {
    mode: "supervised",
    lastRunAt: null,
  },
  missions: [],
  roleDefinitions: [],
  blockerCount: 0,
  activeTaskCount: 0,
  nextDispatchableTaskRole: null,
};

export const emptyProjectsResponse = { projects: [], total: 0 };

export const mockActivityEntry = {
  id: "activity-1",
  projectId: "test-project-1",
  actor: "operator",
  kind: "dispatch",
  summary: "Dispatched task to worker",
  eventType: null,
  createdAt: new Date().toISOString(),
  detail: null,
};
