/**
 * app/(main)/management/parameters/new/page.tsx
 * New parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { auth } from "@/auth";
import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

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

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getParameterDefault = cache(
  async (
    input: ParameterDetailDefaultIn,
  ): Promise<ParameterDetailDefaultOut> => {
    return api.post("/parameters/detail-default", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createParameter(
  input: CreateParameterIn,
): Promise<CreateParameterOut> {
  "use server";
  const out = await api.post("/parameters/create", input);
  revalidateTag("parameters");
  return out;
}

export async function updateParameter(
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
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default parameter detail server-side
  const parameterDetailDefault = await getParameterDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
