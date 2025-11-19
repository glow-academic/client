/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { getSession } from "@/auth";

import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type ParameterDetailDefaultIn = InputOf<
  "/api/v3/parameters/detail-default",
  "post"
>;
type ParameterDetailDefaultOut = OutputOf<
  "/api/v3/parameters/detail-default",
  "post"
>;
type CreateParameterIn = InputOf<"/api/v3/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/api/v3/parameters/create", "post">;
type UpdateParameterIn = InputOf<"/api/v3/parameters/update", "post">;
type UpdateParameterOut = OutputOf<"/api/v3/parameters/update", "post">;

/** ---- Cached fetch with Next tags ---- */
const getParameterDefault = unstable_cache(
  async (profileId: string): Promise<ParameterDetailDefaultOut> => {
    return api.post("/parameters/detail-default", {
      body: { profileId },
    });
  },
  ["parameters:detail-default"],
  { tags: ["parameters"] }
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn,
): Promise<CreateParameterOut> {
  "use server";
  const out = await api.post("/parameters/create", input);
  revalidateTag("parameters");
  return out;
}

async function updateParameter(
  input: UpdateParameterIn,
): Promise<UpdateParameterOut> {
  "use server";
  const out = await api.post("/parameters/update", input);
  revalidateTag("parameters");
  return out;
}

export const metadata: Metadata = {
  title: "New Parameter",
  description: `New parameter creation page for the parameters section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewParameterPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default parameter detail server-side
  const parameterDetailDefault = await getParameterDefault(profileId);

  return (
    <div className="space-y-6" data-page="parameter-new">
      <Parameter
        mode="create"
        parameterDetailDefault={parameterDetailDefault}
        createParameterAction={createParameter}
        updateParameterAction={updateParameter}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateParameterIn,
  CreateParameterOut,
  ParameterDetailDefaultIn,
  ParameterDetailDefaultOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
