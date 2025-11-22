/**
 * app/(main)/engine/prompts/page.tsx
 * Prompts list page
 * @AshokSaravanan222
 * 01/22/2025
 */
import { getSession } from "@/auth";

import Prompts from "@/components/prompts/Prompts";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PromptsListOut = OutputOf<"/api/v3/prompts/list", "post">;
type DeletePromptIn = InputOf<"/api/v3/prompts/delete", "post">;
type DeletePromptOut = OutputOf<"/api/v3/prompts/delete", "post">;
type CreatePromptIn = InputOf<"/api/v3/prompts/create", "post">;
type CreatePromptOut = OutputOf<"/api/v3/prompts/create", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPromptsList = async (profileId: string): Promise<PromptsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/prompts/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createPrompt(
  input: CreatePromptIn
): Promise<CreatePromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/prompts/create", input);
}

async function deletePrompt(input: DeletePromptIn): Promise<DeletePromptOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/prompts/delete", input);
}

export const metadata: Metadata = {
  title: "Prompts",
  description: `Manage prompts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function PromptsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getPromptsList(profileId);

  return (
    <div className="space-y-6" data-page="prompts-index">
      <Prompts listData={listData} deletePromptAction={deletePrompt} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreatePromptIn,
  CreatePromptOut,
  DeletePromptIn,
  DeletePromptOut,
  PromptsListOut,
};
