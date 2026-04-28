import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import {
  loadApprovals,
  loadGlobalBlockers,
  loadGlobalJobs,
  loadGlobalTasks
} from "$lib/server/control-data";
import { serverLogger } from "$lib/server/logger";
import { postJson } from "$lib/server/mutations";

export const load: PageServerLoad = async () => {
  try {
    const [tasks, blockers, approvalsPayload, jobs] = await Promise.all([
      loadGlobalTasks(),
      loadGlobalBlockers(),
      loadApprovals(),
      loadGlobalJobs()
    ]);

    return {
      tasks,
      blockers,
      approvals: Array.isArray(approvalsPayload.approvals) ? approvalsPayload.approvals : [],
      jobs,
      error: null
    };
  } catch (error) {
    serverLogger.loadFailure("tickets/load", error);
    return {
      tasks: [],
      blockers: [],
      approvals: [],
      jobs: [],
      error: "Unable to reach the API. Check that the API service is running."
    };
  }
};

function ticketFormIds(form: FormData) {
  const projectId = String(form.get("projectId") || "").trim();
  const blockerId = String(form.get("blockerId") || "").trim();
  return { projectId, blockerId };
}

async function postBlockerAction(request: Request, action: "approval" | "resolve" | "dismiss", body: Record<string, unknown>, message: string) {
  const { projectId, blockerId } = ticketFormIds(await request.formData());
  if (!projectId || !blockerId) {
    return fail(400, { actionError: "Missing projectId or blockerId" });
  }

  try {
    await postJson(`/projects/${projectId}/blockers/${blockerId}/${action}`, body);
  } catch (err) {
    return fail(400, { actionError: err instanceof Error ? err.message : message });
  }

  throw redirect(303, "/tickets");
}

export const actions: Actions = {
  approve: async ({ request }) => postBlockerAction(request, "approval", { action: "approve" }, "Unable to approve ticket"),
  reject: async ({ request }) => postBlockerAction(request, "approval", { action: "reject" }, "Unable to reject ticket"),
  resolve: async ({ request }) => postBlockerAction(request, "resolve", {}, "Unable to resolve ticket"),
  dismiss: async ({ request }) => postBlockerAction(request, "dismiss", {}, "Unable to dismiss ticket")
};
