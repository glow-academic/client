/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import Parameters from "@/components/parameters/Parameters";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ParametersListOut = OutputOf<"/api/v3/parameters/list", "post">;
type DuplicateParameterIn = InputOf<"/api/v3/parameters/duplicate", "post">;
type DuplicateParameterOut = OutputOf<"/api/v3/parameters/duplicate", "post">;
type DeleteParameterIn = InputOf<"/api/v3/parameters/delete", "post">;
type DeleteParameterOut = OutputOf<"/api/v3/parameters/delete", "post">;
type CreateParameterItemIn = InputOf<"/api/v3/parameters/items/create", "post">;
type CreateParameterItemOut = OutputOf<
  "/api/v3/parameters/items/create",
  "post"
>;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getParametersList = async (
  profileId: string
): Promise<ParametersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/parameters/list",
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
async function duplicateParameter(
  input: DuplicateParameterIn
): Promise<DuplicateParameterOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/duplicate", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

async function deleteParameter(
  input: DeleteParameterIn
): Promise<DeleteParameterOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/delete", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Parameters",
    description:
      "Manage system parameters and configuration settings for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
  };
}

export default async function ContextPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getParametersList(profileId);

  return (
    <div className="space-y-6" data-page="parameters-index">
      <Parameters
        listData={listData}
        duplicateParameterAction={duplicateParameter}
        deleteParameterAction={deleteParameter}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateParameterItemIn,
  CreateParameterItemOut,
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListOut,
};
