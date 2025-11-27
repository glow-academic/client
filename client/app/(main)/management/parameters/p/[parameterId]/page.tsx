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

/** ---- Strong types from OpenAPI ---- */
type ParameterDetailIn = InputOf<"/api/v3/parameters/detail", "post">;
type ParameterDetailOut = OutputOf<"/api/v3/parameters/detail", "post">;

type ParameterNewIn = InputOf<
  "/api/v3/parameters/new",
  "post"
>;
type ParameterNewOut = OutputOf<
  "/api/v3/parameters/new",
  "post"
>;

type CreateParameterIn = InputOf<"/api/v3/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/api/v3/parameters/create", "post">;

type UpdateParameterIn = InputOf<"/api/v3/parameters/update", "post">;
type UpdateParameterOut = OutputOf<"/api/v3/parameters/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameter = async (
  parameterId: string,
  profileId: string
): Promise<ParameterDetailOut> => {
  return api.post(
    "/parameters/detail",
    { body: { parameterId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ parameterId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { parameterId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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

  try {
    const parameter = await getParameter(parameterId, profileId);
    return {
      title: `${parameter?.name || "Parameter"} Parameter`,
      description: `${parameter ? `${parameter.name} ${parameter.description || ""}` : "Parameter"} in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Parameter",
      description: `Parameter in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn
): Promise<CreateParameterOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function updateParameter(
  input: UpdateParameterIn
): Promise<UpdateParameterOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/parameters/update", {
    ...input,
    body: { ...input.body, profileId },
  });
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

  // Fetch parameter detail (always fresh - source of truth)
  try {
    const parameterDetail = await getParameter(parameterId, profileId);

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
  ParameterNewIn,
  ParameterNewOut,
  ParameterDetailIn,
  ParameterDetailOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
