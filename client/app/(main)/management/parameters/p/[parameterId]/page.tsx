/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { auth } from "@/auth";
import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ParameterDetailIn = InputOf<"/api/v3/parameters/detail", "post">;
type ParameterDetailOut = OutputOf<"/api/v3/parameters/detail", "post">;

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
const getParameter = cache(
  async (input: ParameterDetailIn): Promise<ParameterDetailOut> => {
    return api.post("/parameters/detail", input);
  },
);

const getParameterDefault = cache(
  async (
    input: ParameterDetailDefaultIn,
  ): Promise<ParameterDetailDefaultOut> => {
    return api.post("/parameters/detail-default", input);
  },
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { parameterId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const parameter = await getParameter({ body: { parameterId, profileId } });
    return {
      title: `${parameter?.name || "Parameter"} Parameter`,
      description: `${parameter ? `${parameter.name} ${parameter.description || ""}` : "Parameter"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Parameter",
      description: `Parameter in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

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

/** ---- Server renders client with typed data and actions ---- */
export default async function ParameterEditPage({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}) {
  const { parameterId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch data based on mode (edit vs create)
  const [parameterDetail, parameterDetailDefault] = await Promise.all([
    parameterId
      ? getParameter({ body: { parameterId, profileId } }).catch(() => null)
      : Promise.resolve(null),
    !parameterId
      ? getParameterDefault({ body: { profileId } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <Parameter
        parameterId={parameterId}
        mode="edit"
        {...(parameterDetail && { parameterDetail })}
        {...(parameterDetailDefault && { parameterDetailDefault })}
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
  ParameterDetailIn,
  ParameterDetailOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
