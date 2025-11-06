/**
 * app/(main)/create/scenarios/page.tsx
 * Scenario list page - redirects to home with scenarios section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { auth } from "@/auth";
import { Scenarios } from "@/components/scenarios/Scenarios";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ScenariosListIn = InputOf<"/api/v3/scenarios/list", "post">;
type ScenariosListOut = OutputOf<"/api/v3/scenarios/list", "post">;
type DuplicateScenarioIn = InputOf<"/api/v3/scenarios/duplicate", "post">;
type DuplicateScenarioOut = OutputOf<"/api/v3/scenarios/duplicate", "post">;
type DeleteScenarioIn = InputOf<"/api/v3/scenarios/delete", "post">;
type DeleteScenarioOut = OutputOf<"/api/v3/scenarios/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getScenariosList = cache(
  async (input: ScenariosListIn): Promise<ScenariosListOut> => {
    return api.post("/scenarios/list", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateScenario(
  input: DuplicateScenarioIn,
): Promise<DuplicateScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/duplicate", input);
  revalidateTag("scenarios");
  return out;
}

export async function deleteScenario(
  input: DeleteScenarioIn,
): Promise<DeleteScenarioOut> {
  "use server";
  const out = await api.post("/scenarios/delete", input);
  revalidateTag("scenarios");
  return out;
}

export const metadata: Metadata = {
  title: "Scenarios",
  description: `Scenarios in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function ScenariosPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getScenariosList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
