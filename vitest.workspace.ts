import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/domain",
  "packages/constitution",
  "apps/api",
  "apps/control"
]);
