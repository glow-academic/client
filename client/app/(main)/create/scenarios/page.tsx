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
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type ScenariosListOut = OutputOf<"/api/v3/scenarios/list", "post">;
type DuplicateScenarioIn = InputOf<"/api/v3/scenarios/duplicate", "post">;
type DuplicateScenarioOut = OutputOf<"/api/v3/scenarios/duplicate", "post">;
type DeleteScenarioIn = InputOf<"/api/v3/scenarios/delete", "post">;
type DeleteScenarioOut = OutputOf<"/api/v3/scenarios/delete", "post">;

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("scenarios") to invalidate.
 */
const getScenariosList = unstable_cache(
  async (profileId: string): Promise<ScenariosListOut> => {
    return api.post("/scenarios/list", { body: { profileId } });
  },
  ["scenarios:list"],
  { tags: ["scenarios"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateScenario(
  input: DuplicateScenarioIn
): Promise<DuplicateScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/duplicate", input);
  revalidateTag("scenarios");
  const scenarioId = input.body?.scenarioId;
  if (scenarioId) {
    revalidateTag(`scenario:${scenarioId}`);
  }
  return out;
}

export async function deleteScenario(
  input: DeleteScenarioIn
): Promise<DeleteScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/delete", input);
  revalidateTag("scenarios");
  const scenarioId = input.body?.scenarioId;
  if (scenarioId) {
    revalidateTag(`scenario:${scenarioId}`);
  }
  return out;
}

export const metadata: Metadata = {
  title: "Scenarios",
  description: `Scenarios in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

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
