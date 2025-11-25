/**
 * app/(main)/create/scenarios/page.tsx
 * Scenario list page - redirects to home with scenarios section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { getSession } from "@/auth";

import { Scenarios } from "@/components/scenarios/Scenarios";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ScenariosListOut = OutputOf<"/api/v3/scenarios/list", "post">;
type DuplicateScenarioIn = InputOf<"/api/v3/scenarios/duplicate", "post">;
type DuplicateScenarioOut = OutputOf<"/api/v3/scenarios/duplicate", "post">;
type DeleteScenarioIn = InputOf<"/api/v3/scenarios/delete", "post">;
type DeleteScenarioOut = OutputOf<"/api/v3/scenarios/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getScenariosList = async (
  profileId: string
): Promise<ScenariosListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/scenarios/list",
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
async function duplicateScenario(
  input: DuplicateScenarioIn
): Promise<DuplicateScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/duplicate", input);
}

async function deleteScenario(
  input: DeleteScenarioIn
): Promise<DeleteScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/scenarios/delete", input);
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
    title: "Scenarios",
    description: `Scenarios in GLOW${orgPart}.`,
  };
}

export default async function ScenariosPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getScenariosList(profileId);

  return (
    <div className="space-y-6" data-page="scenarios-index">
      <Scenarios
        listData={listData}
        duplicateScenarioAction={duplicateScenario}
        deleteScenarioAction={deleteScenario}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  ScenariosListOut,
};
