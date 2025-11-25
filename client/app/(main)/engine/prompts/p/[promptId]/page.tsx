/**
 * app/(main)/engine/prompts/p/[promptId]/page.tsx
 * Prompt editing page
 * @AshokSaravanan222
 * 01/22/2025
 */

import Prompt from "@/components/prompts/Prompt";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { getSession } from "@/auth";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PromptDetailIn = InputOf<"/api/v3/prompts/detail", "post">;
type PromptDetailOut = OutputOf<"/api/v3/prompts/detail", "post">;

type PromptDetailDefaultIn = InputOf<
  "/api/v3/prompts/detail-default",
  "post"
>;
type PromptDetailDefaultOut = OutputOf<
  "/api/v3/prompts/detail-default",
  "post"
>;
type UpdatePromptIn = InputOf<"/api/v3/prompts/update", "post">;
type UpdatePromptOut = OutputOf<"/api/v3/prompts/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPrompt = async (
  promptId: string,
  profileId: string
): Promise<PromptDetailOut> => {
  return api.post(
    "/prompts/detail",
    { body: { promptId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

const getPromptDefault = async (
  profileId: string
): Promise<PromptDetailDefaultOut> => {
  return api.post(
    "/prompts/detail-default",
    { body: { profileId } },
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
  { params }: { params: Promise<{ promptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { promptId } = await params;
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
    const prompt = await getPrompt(promptId, profileId);
    const title = prompt?.name || "Prompt";
    return {
      title: `${title}`,
      description: prompt?.description || `Prompt in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Prompt",
      description: `Prompt in GLOW${orgPart}.`,
    };
  }
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ promptId: string }>;
}) {
  const { promptId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch data based on mode (edit vs create)
  try {
    const [promptDetail, promptDetailDefault] = await Promise.all([
      promptId
        ? getPrompt(promptId, profileId).catch(() => null)
        : Promise.resolve(null),
      !promptId
        ? getPromptDefault(profileId).catch(() => null)
        : Promise.resolve(null),
    ]);

    return (
      <div
        className="space-y-6"
        data-page="prompt-edit"
        data-prompt-id={promptId}
      >
        <Prompt
          promptId={promptId}
          {...(promptDetail && { promptDetail })}
          {...(promptDetailDefault && { promptDetailDefault })}
          updatePromptAction={updatePrompt}
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
          resourceType="prompt"
          redirectPath="/engine/prompts"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updatePrompt(
  input: UpdatePromptIn,
): Promise<UpdatePromptOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/prompts/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PromptDetailDefaultIn,
  PromptDetailDefaultOut,
  PromptDetailIn,
  PromptDetailOut,
  UpdatePromptIn,
  UpdatePromptOut,
};

