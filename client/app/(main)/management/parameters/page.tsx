/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import { getSession } from "@/auth";

import Parameters from "@/components/parameters/Parameters";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

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

/** ---- Cached fetch with Next tags ----
 * Cache key includes profileId so entries are per-user.
 * Tags allow revalidateTag("parameters") to invalidate.
 */
const getParametersList = unstable_cache(
  async (profileId: string): Promise<ParametersListOut> => {
    return api.post("/parameters/list", { body: { profileId } });
  },
  ["parameters:list"],
  { tags: ["parameters"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateParameter(
  input: DuplicateParameterIn
): Promise<DuplicateParameterOut> {
  "use server";
  const out = await api.post("/parameters/duplicate", input);
  revalidateTag("parameters");
  const parameterId = input.body?.parameterId;
  if (parameterId) {
    revalidateTag(`parameter:${parameterId}`);
  }
  return out;
}

async function deleteParameter(
  input: DeleteParameterIn
): Promise<DeleteParameterOut> {
  "use server";
  const out = await api.post("/parameters/delete", input);
  revalidateTag("parameters");
  const parameterId = input.body?.parameterId;
  if (parameterId) {
    revalidateTag(`parameter:${parameterId}`);
  }
  return out;
}

export async function createParameterItem(
  input: CreateParameterItemIn
): Promise<CreateParameterItemOut> {
  "use server";
  const out = await api.post("/parameters/items/create", input);
  revalidateTag("parameters");
  return out;
}

export const metadata: Metadata = {
  title: "Parameters",
  description: `Manage parameters in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function ContextPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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
