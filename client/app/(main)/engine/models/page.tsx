/**
 * app/(main)/engine/models/page.tsx
 * Models list page
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";

import Models from "@/components/models/Models";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelsListOut = OutputOf<"/api/v3/models/list", "post">;
type DuplicateModelIn = InputOf<"/api/v3/models/duplicate", "post">;
type DuplicateModelOut = OutputOf<"/api/v3/models/duplicate", "post">;
type DeleteModelIn = InputOf<"/api/v3/models/delete", "post">;
type DeleteModelOut = OutputOf<"/api/v3/models/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getModelsList = async (
  profileId: string
): Promise<ModelsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/models/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
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

async function deleteModel(
  input: DeleteModelIn,
): Promise<DeleteModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Models",
    description: `Manage AI models in GLOW${orgPart}.`,
  };
}

export default async function ModelsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getModelsList(profileId);

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

