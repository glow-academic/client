/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import { auth } from "@/auth";
import Parameters from "@/components/parameters/Parameters";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ParametersListIn = InputOf<"/api/v3/parameters/list", "post">;
type ParametersListOut = OutputOf<"/api/v3/parameters/list", "post">;
type DuplicateParameterIn = InputOf<"/api/v3/parameters/duplicate", "post">;
type DuplicateParameterOut = OutputOf<"/api/v3/parameters/duplicate", "post">;
type DeleteParameterIn = InputOf<"/api/v3/parameters/delete", "post">;
type DeleteParameterOut = OutputOf<"/api/v3/parameters/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getParametersList = cache(
  async (input: ParametersListIn): Promise<ParametersListOut> => {
    return api.post("/parameters/list", input);
  }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateParameter(
  input: DuplicateParameterIn
): Promise<DuplicateParameterOut> {
  "use server";
  const out = await api.post("/parameters/duplicate", input);
  revalidateTag("parameters");
  return out;
}

export async function deleteParameter(
  input: DeleteParameterIn
): Promise<DeleteParameterOut> {
  "use server";
  const out = await api.post("/parameters/delete", input);
  revalidateTag("parameters");
  return out;
}

export const metadata: Metadata = {
  title: "Parameters",
  description: `Manage parameters in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function ContextPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getParametersList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListOut,
};
