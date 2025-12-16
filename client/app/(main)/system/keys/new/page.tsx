/**
 * app/(main)/system/keys/new/page.tsx
 * New key page for the keys section.
 */

import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeyNewIn = InputOf<"/api/v3/keys/new", "post">;
type KeyNewOut = OutputOf<"/api/v3/keys/new", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;

type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt-key", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt-key", "post">;

/** ---- Strongly-typed server actions ---- */
async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  return api.post("/keys/decrypt-key", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Key",
    description:
      "Create a new API key for teaching assistant training platform. Generate secure access credentials, configure API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}

export default async function NewKeyPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch key default data (for dropdowns and defaults)
  return (
    <div
      className="space-y-6"
      data-page="key-new"
      aria-label="Create new key page"
    >
      <Key
        createKeyAction={createKey}
        decryptKeyAction={decryptKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateKeyIn,
  CreateKeyOut,
  KeyNewIn,
  KeyNewOut,
  DecryptKeyIn,
  DecryptKeyOut,
};
