/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Parameter from "@/components/parameters/Parameter";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ParameterDetailIn = InputOf<"/api/v3/parameters/detail", "post">;
type ParameterDetailOut = OutputOf<"/api/v3/parameters/detail", "post">;

type ParameterNewIn = InputOf<"/api/v3/parameters/new", "post">;
type ParameterNewOut = OutputOf<"/api/v3/parameters/new", "post">;

type CreateParameterIn = InputOf<"/api/v3/parameters/create", "post">;
type CreateParameterOut = OutputOf<"/api/v3/parameters/create", "post">;

type UpdateParameterIn = InputOf<"/api/v3/parameters/update", "post">;
type UpdateParameterOut = OutputOf<"/api/v3/parameters/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getParameter = async (
  parameterId: string
): Promise<ParameterDetailOut> => {
  return api.post(
    "/parameters/detail",
    { body: { parameterId } },
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

  try {
    const parameter = await getParameter(parameterId);
    return {
      title: `${parameter?.name || "Parameter"} Parameter`,
      description: `${parameter?.name ? `${parameter.name} - ` : ""}System parameter configuration for teaching assistant training platform.${parameter?.description ? ` ${parameter.description}` : ""} Manage platform-wide settings and learning environment configurations for effective L&D program administration.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Parameter",
    description:
      "System parameter configuration for teaching assistant training platform. Manage platform-wide settings and learning environment configurations for effective L&D program administration.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn
): Promise<CreateParameterOut> {
  "use server";
  return api.post("/parameters/create", {
    ...input,
    body: { ...input.body },
  });
}

async function updateParameter(
  input: UpdateParameterIn
): Promise<UpdateParameterOut> {
  "use server";
  return api.post("/parameters/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ParameterEditPage({
  params,
}: {
  params: Promise<{ parameterId: string }>;
}) {
  const { parameterId } = await params;
  // Fetch parameter detail (always fresh - source of truth)
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const parameterDetail = await getParameter(parameterId);

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
        <UnifiedAccessDenied
          reason="department"
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
  ParameterDetailIn,
  ParameterDetailOut,
  ParameterNewIn,
  ParameterNewOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
