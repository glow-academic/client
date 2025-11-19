/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { getSession } from "@/auth";

import Parameter from "@/components/parameters/Parameter";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

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
const getParameter = (parameterId: string) =>
  unstable_cache(
    async (profileId: string): Promise<ParameterDetailOut> => {
      return api.post("/parameters/detail", {
        body: { parameterId, profileId },
      });
    },
    ["parameters:detail", parameterId],
    { tags: ["parameters", `parameter:${parameterId}`] }
  );

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { parameterId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const parameter = await getParameter(parameterId)(profileId);
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
  input: CreateParameterIn
): Promise<CreateParameterOut> {
  "use server";
  const out = await api.post("/parameters/create", input);
  revalidateTag("parameters");
  const parameterId = out.parameterId;
  if (parameterId) {
    revalidateTag(`parameter:${parameterId}`);
  }
  return out;
}

export async function updateParameter(
  input: UpdateParameterIn
): Promise<UpdateParameterOut> {
  "use server";
  const out = await api.post("/parameters/update", input);
  revalidateTag("parameters");
  const parameterId = input.body?.parameterId;
  if (parameterId) {
    revalidateTag(`parameter:${parameterId}`);
  }
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ParameterEditPage({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}) {
  const { parameterId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch parameter detail (cached, won't duplicate with metadata)
  try {
    const parameterDetail = await getParameter(parameterId)(profileId);

    return (
      <div
        className="space-y-6"
        data-page="parameter-edit"
        data-parameter-id={parameterId}
      >
        <Parameter
          parameterId={parameterId}
          mode="edit"
          parameterDetail={parameterDetail}
          createParameterAction={createParameter}
          updateParameterAction={updateParameter}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <DepartmentAccessDenied
          resourceType="parameter"
          redirectPath="/management/parameters"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
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
