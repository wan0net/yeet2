import { StatusBadge } from "@yeet2/ui";

import { ProjectsClient } from "./projects-client";

export default function ProjectsPage() {
  return (
    <main className="mt-10 space-y-6">
      <section className="max-w-3xl space-y-4">
        <StatusBadge>project registry</StatusBadge>
        <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Attach an existing local repository, inspect its constitution files, and keep the project state visible in one place.
        </p>
      </section>

      <ProjectsClient />
    </main>
  );
}
