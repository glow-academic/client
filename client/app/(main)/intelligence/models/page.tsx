/**
 * app/(main)/engine/models/page.tsx
 * Models list page
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Models from "@/components/models/Models";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelsListOut = OutputOf<"/api/v4/models/list", "post">;
type DuplicateModelIn = InputOf<"/api/v4/models/duplicate", "post">;
type DuplicateModelOut = OutputOf<"/api/v4/models/duplicate", "post">;
type DeleteModelIn = InputOf<"/api/v4/models/delete", "post">;
type DeleteModelOut = OutputOf<"/api/v4/models/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getModelsList = async (): Promise<ModelsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/models/list",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateModel(
  input: DuplicateModelIn,
): Promise<DuplicateModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/duplicate", input);
}

async function deleteModel(input: DeleteModelIn): Promise<DeleteModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Models",
    description:
      "Manage AI language models for teaching assistant training simulations. Configure and customize AI models to power realistic student personas and enhance simulation-based learning experiences for pedagogical development.",
  };
}

export default async function ModelsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getModelsList();

  return (
    <div className="space-y-6" data-page="models-index">
      <Models
        listData={listData}
        duplicateModelAction={duplicateModel}
        deleteModelAction={deleteModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteModelIn,
  DeleteModelOut,
  DuplicateModelIn,
  DuplicateModelOut,
  ModelsListOut,
};
