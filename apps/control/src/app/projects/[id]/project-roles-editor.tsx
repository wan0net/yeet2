"use client";

import { SectionCard } from "@yeet2/ui";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";

import type { ProjectRoleDefinition } from "../../../lib/projects";

interface ProjectRolesEditorProps {
  projectId: string;
  projectName: string;
  roleDefinitions: ProjectRoleDefinition[];
}

interface RoleModelCatalogResponse {
  models?: Array<string | { id?: unknown; name?: unknown; label?: unknown; value?: unknown }>;
  error?: string;
  detail?: unknown;
  message?: string;
}

function cloneRoles(roleDefinitions: ProjectRoleDefinition[]): ProjectRoleDefinition[] {
  return roleDefinitions.map((role) => ({ ...role }));
}

function serializeRoles(roleDefinitions: ProjectRoleDefinition[]): Array<Pick<ProjectRoleDefinition, "roleKey" | "sortOrder" | "label" | "enabled" | "model" | "goal" | "backstory">> {
  return roleDefinitions.map((role, index) => ({
    roleKey: role.roleKey || role.id,
    sortOrder: role.sortOrder ?? index,
    label: role.label,
    enabled: role.enabled,
    model: role.model?.trim() || null,
    goal: role.goal,
    backstory: role.backstory
  }));
}

function detailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === "object") {
    const record = detail as { detail?: unknown; message?: unknown; error?: unknown };
    for (const candidate of [record.detail, record.message, record.error]) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return fallback;
}

function normalizeModelOption(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object") {
    const record = value as { id?: unknown; value?: unknown; label?: unknown; name?: unknown };
    for (const candidate of [record.id, record.value, record.label, record.name]) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return null;
}

export function ProjectRolesEditor({ projectId, projectName, roleDefinitions }: ProjectRolesEditorProps) {
  const router = useRouter();
  const [draftRoles, setDraftRoles] = useState<ProjectRoleDefinition[]>(() => cloneRoles(roleDefinitions));
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraftRoles(cloneRoles(roleDefinitions));
  }, [roleDefinitions]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadModelCatalog() {
      setModelsLoading(true);
      setModelsError(null);

      try {
        const response = await fetch(`/api/projects/${projectId}/role-models`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => null)) as RoleModelCatalogResponse | null;

        if (!response.ok) {
          throw new Error(detailMessage(payload?.detail ?? payload?.message ?? payload?.error, "Unable to load available models"));
        }

        setAvailableModels(Array.isArray(payload?.models) ? [...new Set(payload.models.map(normalizeModelOption).filter((entry): entry is string => entry !== null))] : []);
      } catch (catalogError) {
        if (controller.signal.aborted) {
          return;
        }

        setAvailableModels([]);
        setModelsError(catalogError instanceof Error ? catalogError.message : "Unable to load available models");
      } finally {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      }
    }

    void loadModelCatalog();

    return () => {
      controller.abort();
    };
  }, [projectId]);

  function updateRole(index: number, patch: Partial<ProjectRoleDefinition>) {
    setDraftRoles((current) =>
      current.map((role, currentIndex) => (currentIndex === index ? { ...role, ...patch } : role))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ roleDefinitions: serializeRoles(draftRoles) })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; detail?: unknown; message?: string } | null;

      if (!response.ok) {
        throw new Error(detailMessage(payload?.detail ?? payload?.message ?? payload?.error, "Unable to save role definitions"));
      }

      setMessage(`Saved role definitions for ${projectName}.`);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save role definitions");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <SectionCard title="Project roles">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          View and edit the role definitions used for {projectName}. Save will proxy through the control API route and will stay editable if the backend route is not available yet.
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {draftRoles.map((role, index) => (
            <article key={role.roleKey || role.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Role key</div>
                  <div className="mt-1 break-all font-mono text-sm text-slate-800">{role.roleKey || role.id}</div>
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <input
                    checked={role.enabled}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    onChange={(event) => updateRole(index, { enabled: event.currentTarget.checked })}
                    type="checkbox"
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Label</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    onChange={(event) => updateRole(index, { label: event.currentTarget.value })}
                    value={role.label}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Model</span>
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    onChange={(event) => updateRole(index, { model: event.currentTarget.value })}
                    list={`project-role-models-${projectId}`}
                    placeholder="Select or type a model"
                    value={role.model ?? ""}
                  />
                  <datalist id={`project-role-models-${projectId}`}>
                    {availableModels.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  <div className="text-xs text-slate-500">
                    Leave blank to use the Brain default model.
                    {modelsLoading ? " Loading available models..." : null}
                    {modelsError ? ` Catalog unavailable: ${modelsError}` : null}
                  </div>
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Goal</span>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    onChange={(event) => updateRole(index, { goal: event.currentTarget.value })}
                    value={role.goal}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Backstory</span>
                  <textarea
                    className="min-h-28 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    onChange={(event) => updateRole(index, { backstory: event.currentTarget.value })}
                    value={role.backstory}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
            type="submit"
          >
            {isSaving ? "Saving..." : "Save role definitions"}
          </button>
          <span className="text-xs text-slate-500">The save request is sent through the control app proxy route.</span>
        </div>

        {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      </form>
    </SectionCard>
  );
}
