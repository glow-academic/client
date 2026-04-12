/**
 * Derive generation config from the current route.
 *
 * Convention-based: the URL tells us everything.
 *   /training/personas/new?draftId=xxx → persona, create+draft+get, draft_id
 *   /training/personas/[id]            → persona, update+get, artifact_id
 *   /management/documents/new          → document, create+draft+get
 */

import type { Permission } from "@/hooks/use-generate";

export interface GenerationConfig {
  /** Artifact type derived from route (e.g. "persona", "scenario") */
  artifactType: string;
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

/**
 * Derive generation config from pathname + search params.
 * Returns null if the current route isn't an artifact page.
 */
export function deriveGenerationConfig(
  pathname: string,
  searchParams: URLSearchParams,
): GenerationConfig | null {
  // Match: /{section}/{artifact_plural}/{new|[id]}
  const match = pathname.match(/\/(\w+)\/(new|[\w-]+)$/);
  if (!match) return null;

  const segment = pathname.split("/").find((s) => ARTIFACT_ROUTES[s]);
  if (!segment) return null;

  const artifactType = ARTIFACT_ROUTES[segment];
  const tail = match[2];
  const isNew = tail === "new";

  // Permissions based on mode
  const operations = isNew
    ? ["create", "draft", "get"]
    : ["update", "get"];
  const permissions = operations.map((op) => ({
    artifact: artifactType,
    operation: op,
  }));

  // Params from URL
  const params: Record<string, string> = {};
  const draftId = searchParams.get("draftId");
  if (draftId) params.draft_id = draftId;
  if (!isNew) params.artifact_id = tail;

  return { artifactType, permissions, params };
}
