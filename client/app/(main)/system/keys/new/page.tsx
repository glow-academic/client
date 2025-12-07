/**
 * app/(main)/system/keys/new/page.tsx
 * New key page for the keys section.
 */

import { getSession } from "@/auth";

import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeyNewIn = InputOf<"/api/v3/keys/new", "post">;
type KeyNewOut = OutputOf<"/api/v3/keys/new", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getKeyDefault = async (profileId: string): Promise<KeyNewOut> => {
  return api.post(
    "/keys/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server action ---- */
async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  return {
    title: "New Key",
    description: "Create a new API key for teaching assistant training platform. Generate secure access credentials, configure API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}
}

export default async function NewKeyPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch key default data (for dropdowns and defaults)
  const keyDetailDefault = await getKeyDefault(profileId);

  return (
    <div
      className="space-y-6"
      data-page="key-new"
      aria-label="Create new key page"
    >
      <Key keyDetailDefault={keyDetailDefault} createKeyAction={createKey} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateKeyIn, CreateKeyOut, KeyNewIn, KeyNewOut };
