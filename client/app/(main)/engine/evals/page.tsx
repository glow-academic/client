/**
 * app/(main)/engine/evals/page.tsx
 * Evals list page
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";

import Evals from "@/components/evals/Evals";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/api/v3/evals/list", "post">;
type DeleteEvalIn = InputOf<"/api/v3/evals/delete", "post">;
type DeleteEvalOut = OutputOf<"/api/v3/evals/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getEvalsList = async (profileId: string): Promise<EvalsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/evals/list",
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

/** ---- Strongly-typed server actions ---- */
async function deleteEval(input: DeleteEvalIn): Promise<DeleteEvalOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/evals/delete", {
    ...input,
    body: { ...input.body, profileId },
  });
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
    title: "Evals",
    description: `Manage evals in GLOW${orgPart}.`,
  };
}

export default async function EvalsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getEvalsList(profileId);

  return (
    <div className="space-y-6" data-page="evals-index">
      <Evals listData={listData} deleteEvalAction={deleteEval} />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type { DeleteEvalIn, DeleteEvalOut, EvalsListOut };

