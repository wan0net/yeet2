<script lang="ts">
	import type { PageData, ActionData } from "./$types";
	import Markdown from "$lib/ui/Markdown.svelte";

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const fileLabels: Record<string, string> = {
		vision: "Vision",
		spec: "Spec",
		roadmap: "Roadmap",
		architecture: "Architecture",
		decisions: "Decisions",
		qualityBar: "Quality Bar"
	};

	const fileContent = $derived(data.file?.content ?? "");
	let editorContent = $state("");

	$effect(() => {
		editorContent = fileContent;
	});
</script>

<section class="page-header">
	<div class="stack">
		<span class="eyebrow">Constitution editor</span>
		<div>
			<h1>{data.project.name}</h1>
			<p>Edit the project constitution files that guide autonomous planning.</p>
		</div>
	</div>
	<a class="btn secondary" href={`/projects/${data.project.id}`}>Back to project</a>
</section>

<nav class="tab-row">
	{#each data.fileKeys as key}
		<a
			class="tab {key === data.activeKey ? 'active' : ''}"
			href={`/projects/${data.project.id}/constitution?file=${key}`}
		>
			{fileLabels[key] ?? key}
			{#if data.project.constitution.files}
				{@const present = data.project.constitution.files[key as keyof typeof data.project.constitution.files]}
				<span class="pill {present ? 'success' : 'muted'}" style="font-size: 0.625rem; padding: 0.1rem 0.3rem; margin-left: 0.25rem;">{present ? "exists" : "missing"}</span>
			{/if}
		</a>
	{/each}
</nav>

{#if form?.actionError}
	<section class="card" style="border-color: var(--color-status-error);">
		<div class="card-body">{form.actionError}</div>
	</section>
{/if}

<section class="constitution-editor">
	<div class="editor-pane">
		<div class="card">
			<div class="card-header">
				{fileLabels[data.activeKey] ?? data.activeKey}
				{#if data.file?.path}
					<span class="muted" style="font-weight: normal; margin-left: var(--space-2);">{data.file.path}</span>
				{/if}
			</div>
			<div class="card-body">
				<form method="POST" action="?/save">
					<input type="hidden" name="fileKey" value={data.activeKey} />
					<textarea
						name="content"
						class="constitution-textarea"
						bind:value={editorContent}
						placeholder={`Write ${fileLabels[data.activeKey] ?? data.activeKey} content in Markdown...`}
						rows="24"
					></textarea>
					<div style="margin-top: var(--space-3); display: flex; gap: var(--space-2); align-items: center;">
						<button class="btn primary" type="submit">Save</button>
						<span class="muted">{data.file?.exists ? "File exists on disk" : "File will be created"}</span>
					</div>
				</form>
			</div>
		</div>
	</div>

	<div class="preview-pane">
		<div class="card">
			<div class="card-header">Preview</div>
			<div class="card-body">
				{#if editorContent}
					<Markdown content={editorContent} />
				{:else}
					<div class="empty-state">Start typing to see a preview.</div>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.tab-row {
		display: flex;
		gap: var(--space-1, 0.25rem);
		margin-bottom: var(--space-4, 1rem);
		flex-wrap: wrap;
	}
	.tab {
		padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
		border-radius: var(--radius-md, 0.5rem);
		text-decoration: none;
		color: var(--color-text-secondary, #aaa);
		background: var(--color-surface-raised, #1a1a1a);
		font-size: var(--font-size-sm, 0.8125rem);
		display: inline-flex;
		align-items: center;
		transition: background 0.15s, color 0.15s;
	}
	.tab:hover {
		background: var(--color-surface-hover, #252525);
		color: var(--color-text-primary, #fff);
	}
	.tab.active {
		background: var(--color-accent, #60a5fa);
		color: var(--color-text-on-accent, #000);
	}
	.constitution-editor {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-4, 1rem);
	}
	@media (max-width: 900px) {
		.constitution-editor {
			grid-template-columns: 1fr;
		}
	}
	.constitution-textarea {
		width: 100%;
		min-height: 400px;
		font-family: var(--font-mono, monospace);
		font-size: var(--font-size-sm, 0.8125rem);
		line-height: 1.6;
		background: var(--color-surface-sunken, #111);
		color: var(--color-text-primary, #eee);
		border: 1px solid var(--color-border, #333);
		border-radius: var(--radius-md, 0.5rem);
		padding: var(--space-3, 0.75rem);
		resize: vertical;
	}
	.constitution-textarea:focus {
		outline: 2px solid var(--color-accent, #60a5fa);
		outline-offset: -1px;
		border-color: transparent;
	}
</style>
