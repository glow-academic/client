/**
 * app/(main)/engine/prompts/new/page.tsx
 * New prompt creation page
 * @AshokSaravanan222
 * 01/22/2025
 */

import { createPrompt } from "@/app/(main)/engine/prompts/page";
import { getSession } from "@/auth";

import Prompt from "@/components/prompts/Prompt";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type PromptDetailDefaultIn = InputOf<
  "/api/v3/prompts/detail-default",
  "post"
>;
type PromptDetailDefaultOut = OutputOf<
  "/api/v3/prompts/detail-default",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getPromptDefault = cache(
  async (input: PromptDetailDefaultIn): Promise<PromptDetailDefaultOut> => {
    return api.post("/prompts/detail-default", input);
  }
);

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

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

  return {
    title: "New Prompt",
    description: `New prompt creation page in GLOW${orgPart}.`,
  };
}

/** ---- Server renders client with typed data (mutations in child components) ---- */
export default async function NewPromptPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default prompt detail server-side
  const promptDetailDefault = await getPromptDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Prompt
        promptDetailDefault={promptDetailDefault}
        createPromptAction={createPrompt}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PromptDetailDefaultIn, PromptDetailDefaultOut };

