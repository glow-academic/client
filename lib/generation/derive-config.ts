/**
 * Derive generation config from the current route.
 *
 * Convention-based: the URL tells us everything.
 *   /training/personas            → persona list, search+create+delete+duplicate+export+csv+docs
 *   /training/personas/new?draftId=xxx → persona new, create+draft+get+docs
 *   /training/personas/[id]       → persona edit, draft+get+docs
 *   /management/documents/new     → document new, create+draft+get+docs
 */

import type { Permission } from "@/hooks/use-generate";

export interface GenerationConfig {
  /** Artifact type derived from route (e.g. "persona", "scenario") */
  artifactType: string;
  /** Page mode: "list", "new", or "edit" */
  mode: "list" | "new" | "edit";
  /** Permissions for the AI model */
  permissions: Permission[];
  /** Contextual params the model can pass to tools */
  params: Record<string, string>;
}

/** Route segments that map to artifact pages */
const ARTIFACT_ROUTES: Record<string, string> = {
  personas: "persona",
  scenarios: "scenario",
  simulations: "simulation",
  cohorts: "cohort",
  documents: "document",
  profiles: "profile",
  fields: "field",
  parameters: "parameter",
};

/** Operations by page mode */
const MODE_OPERATIONS: Record<string, string[]> = {
  list: ["search", "create", "update", "delete", "duplicate", "export", "csv", "docs"],
  new: ["draft", "get", "docs"],
  edit: ["draft", "get", "docs"],
};

/**
 * Derive generation config from pathname + search params.
 * Returns null if the current route isn't an artifact page.
 */
export function deriveGenerationConfig(
  pathname: string,
  searchParams: URLSearchParams,
): GenerationConfig | null {
  const segment = pathname.split("/").find((s) => ARTIFACT_ROUTES[s]);
  if (!segment) return null;

  const artifactType = ARTIFACT_ROUTES[segment];

  // Determine mode from URL tail
  const match = pathname.match(/\/(\w+)\/(new|[\w-]+)$/);
  const tail = match?.[2];

  let mode: "list" | "new" | "edit";
  if (!tail || tail === segment) {
    mode = "list";
  } else if (tail === "new") {
    mode = "new";
  } else {
    mode = "edit";
  }

  // Permissions based on mode
  const operations = MODE_OPERATIONS[mode];
  const permissions = [
    ...operations.map((op) => ({ artifact: artifactType, operation: op })),
    { artifact: artifactType, operation: "group" },
  ];

  // Params from URL
  const params: Record<string, string> = {};
  const draftId = searchParams.get("draftId");
  if (draftId) params.draft_id = draftId;
  if (mode === "edit" && tail) params.artifact_id = tail;

  return { artifactType, mode, permissions, params };
}
