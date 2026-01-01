/**
 * app/(main)/system/keys/new/page.tsx
 * New key page for the keys section.
 */

import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeyNewIn = InputOf<"/api/v4/keys/new", "post">;
type KeyNewOut = OutputOf<"/api/v4/keys/new", "post">;
type CreateKeyIn = InputOf<"/api/v4/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v4/keys/create", "post">;

type DecryptKeyIn = InputOf<"/api/v4/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v4/keys/decrypt", "post">;

/** ---- Strongly-typed server actions ---- */
async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  return api.post("/keys/create", { ...input });
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt", { ...input });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Key",
    description:
      "Create a new API key for teaching assistant training platform. Generate secure access credentials, configure API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}

export default async function NewKeyPage() {
  // Fetch key default data (for dropdowns and defaults)
  return (
    <div
      className="space-y-6"
      data-page="key-new"
      aria-label="Create new key page"
    >
      <Key createKeyAction={createKey} decryptKeyAction={decryptKey} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  KeyNewIn,
  KeyNewOut,
};
