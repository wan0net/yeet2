import { error, fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { loadProject } from "$lib/server/control-data";
import { apiJson } from "$lib/server/api";
import { putJson } from "$lib/server/mutations";

const FILE_KEYS = ["vision", "spec", "roadmap", "architecture", "decisions", "qualityBar"] as const;
type FileKey = (typeof FILE_KEYS)[number];

function isFileKey(value: string): value is FileKey {
	return (FILE_KEYS as readonly string[]).includes(value);
}

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
	const validKey: FileKey = isFileKey(activeKey) ? activeKey : "vision";

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

		if (!fileKey || !isFileKey(fileKey)) {
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
