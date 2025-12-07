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

/** ---- Strong types from OpenAPI ---- */
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
const getParameterDefault = async (
  profileId: string
): Promise<ParameterNewOut> => {
  return api.post(
    "/parameters/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createParameter(
  input: CreateParameterIn,
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
  input: UpdateParameterIn,
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Parameter",
    description: "Create a new system parameter for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
  };
}
}

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
  ParameterNewIn,
  ParameterNewOut,
  UpdateParameterIn,
  UpdateParameterOut,
};
