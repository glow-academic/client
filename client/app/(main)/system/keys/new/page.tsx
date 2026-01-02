/**
 * app/(main)/system/keys/new/page.tsx
 * New key page for the keys section.
 */

import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type KeyNewIn = InputOf<"/api/v4/keys/new", "post">;
type KeyNewOut = OutputOf<"/api/v4/keys/new", "post">;
type CreateKeyIn = InputOf<"/api/v4/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v4/keys/create", "post">;
type PatchKeyDraftIn = InputOf<"/api/v4/keys/draft", "patch">;
type PatchKeyDraftOut = OutputOf<"/api/v4/keys/draft", "patch">;

type DecryptKeyIn = InputOf<"/api/v4/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v4/keys/decrypt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getKeyDefault = async (input: KeyNewIn): Promise<KeyNewOut> => {
  return api.post("/keys/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  return api.post("/keys/create", { ...input });
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt", { ...input });
}

async function patchKeyDraft(
  input: PatchKeyDraftIn
): Promise<PatchKeyDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/keys/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Key",
    description:
      "Create a new API key for teaching assistant training platform. Generate secure access credentials, configure API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}

export default async function NewKeyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for key search params
  const keySearchParams = {
    draftId: parseAsString,
  };
  const loadKeySearchParams = createLoader(keySearchParams);
  const q = loadKeySearchParams(searchParamsObj);

  // Fetch default key detail server-side with draft_id
  const input: KeyNewIn = {
    draft_id: q.draftId ?? null,
  } as KeyNewIn;
  const keyDetailDefault = await getKeyDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="key-new"
      aria-label="Create new key page"
    >
      <Key
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        keyDetailDefault={keyDetailDefault}
        createKeyAction={createKey}
        decryptKeyAction={decryptKey}
        patchKeyDraftAction={patchKeyDraft}
      />
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
  PatchKeyDraftIn,
  PatchKeyDraftOut,
};
