/**
 * app/(main)/system/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Rubric from "@/components/artifacts/rubric/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { resolveGroupId } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/api/v4/artifacts/rubrics/get", "post">;
type GetRubricOut = OutputOf<"/api/v4/artifacts/rubrics/get", "post">;
type SaveRubricIn = InputOf<"/api/v4/artifacts/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/artifacts/rubrics/save", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getRubric = async (
  draftId: string | null,
  descriptionSearch: string | null,
  standardGroupSearch: string | null,
  groupId: string | null = null,
): Promise<GetRubricOut> => {
  return api.post(
    "/artifacts/rubrics/get",
    ({
      body: {
        rubric_id: null,
        draft_id: draftId || null,
        group_id: groupId,
        description_search: descriptionSearch || null,
        standard_group_search: standardGroupSearch || null,
      },
    } as GetRubricIn),
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveRubric(input: SaveRubricIn): Promise<SaveRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/rubrics/save", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/rubrics/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftPoints(
  input: CreateDraftPointsIn
): Promise<CreateDraftPointsOut> {
  "use server";
  return api.post("/resources/points", input);
}

async function createDraftStandardGroups(
  input: CreateDraftStandardGroupsIn
): Promise<CreateDraftStandardGroupsOut> {
  "use server";
  return api.post("/resources/standard_groups", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/rubrics/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/rubrics/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/rubrics/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Server renders client with typed data (mutations in child components) ---- */
export default async function NewRubricPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for rubric search params
  const rubricSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    standardGroupSearch: parseAsString,
  };
  const loadRubricSearchParams = createLoader(rubricSearchParams);
  const q = loadRubricSearchParams(searchParamsObj);

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "rubric" })).group_id;

  // Fetch rubric data using unified get endpoint (rubric_id = null for new mode)
  const rubricData = await getRubric(
    q.draftId ?? null,
    q.descriptionSearch ?? null,
    q.standardGroupSearch ?? null,
    groupId,
  );

  return (
    <div className="space-y-6" data-page="rubric-new">
      <Rubric
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        rubricData={rubricData}
        saveRubricAction={saveRubric}
        patchRubricDraftAction={patchRubricDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createPointsAction={createDraftPoints}
        createStandardGroupsAction={createDraftStandardGroups}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
