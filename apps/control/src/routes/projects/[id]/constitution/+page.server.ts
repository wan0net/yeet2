import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadProject } from "$lib/server/control-data";
import { apiJson } from "$lib/server/api";
import { putJson } from "$lib/server/mutations";

const FILE_KEYS = ["vision", "spec", "roadmap", "architecture", "decisions", "qualityBar"] as const;

interface ConstitutionFileResponse {
	fileKey: string;
	path: string;
	content: string;
	exists: boolean;
}

export const load: PageServerLoad = async ({ params, url }) => {
	const project = await loadProject(params.id);
	if (!project) {
		throw error(404, "Project not found");
	}

	const activeKey = url.searchParams.get("file") || "vision";
	const validKey = FILE_KEYS.includes(activeKey as any) ? activeKey : "vision";

	let file: ConstitutionFileResponse | null = null;
	try {
		file = await apiJson<ConstitutionFileResponse>(`/projects/${params.id}/constitution/${validKey}`);
	} catch {
		// File may not exist yet.
	}

	return {
		project,
		fileKeys: [...FILE_KEYS],
		activeKey: validKey,
		file
	};
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const form = await request.formData();
		const fileKey = String(form.get("fileKey") || "").trim();
		const content = String(form.get("content") || "");

		if (!fileKey || !FILE_KEYS.includes(fileKey as any)) {
			return fail(400, { actionError: "Invalid file key" });
		}

		try {
			await putJson(`/projects/${params.id}/constitution/${fileKey}`, { content });
		} catch (err) {
			return fail(400, { actionError: err instanceof Error ? err.message : "Unable to save file" });
		}

		throw redirect(303, `/projects/${params.id}/constitution?file=${fileKey}`);
	}
};
