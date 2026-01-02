/**
 * app/(main)/system/keys/k/[keyId]/page.tsx
 * Key editing page
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type KeyDetailIn = InputOf<"/api/v4/keys/detail", "post">;
type KeyDetailOut = OutputOf<"/api/v4/keys/detail", "post">;

type UpdateKeyIn = InputOf<"/api/v4/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v4/keys/update", "post">;
type PatchKeyDraftIn = InputOf<"/api/v4/keys/draft", "patch">;
type PatchKeyDraftOut = OutputOf<"/api/v4/keys/draft", "patch">;

type DecryptKeyIn = InputOf<"/api/v4/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v4/keys/decrypt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getKey = async (input: KeyDetailIn): Promise<KeyDetailOut> => {
  return api.post("/keys/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ keyId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { keyId } = await params;
  try {
    const input: KeyDetailIn = {
      key_id: keyId,
      draft_id: null,
    } as KeyDetailIn;
    const key = await getKey(input);
    return {
      title: `${key?.name || "Key"}`,
      description: `${key?.name ? `${key.name} - ` : ""}API key configuration for teaching assistant training platform. Manage secure access credentials and API integrations for educational institutions and L&D programs.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Key",
    description:
      "API key configuration for teaching assistant training platform. Manage secure access credentials and API integrations for educational institutions and L&D programs.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/update", {
    ...input,
    body: { ...input.body },
  });
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt", {
    ...input,
    body: { ...input.body },
  });
}

async function patchKeyDraft(
  input: PatchKeyDraftIn
): Promise<PatchKeyDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/keys/draft", input);
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditKeyPage({
  params,
  searchParams,
}: {
  params: Promise<{ keyId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { keyId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
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

  // Fetch data for edit mode with draft_id
  try {
    const input: KeyDetailIn = {
      key_id: keyId,
      draft_id: q.draftId ?? null,
    } as KeyDetailIn;
    const keyDetail = await getKey(input).catch(() => null);

    if (!keyDetail) {
      throw new Error("Key not found");
    }

    return (
      <div className="space-y-6" data-page="key-edit" data-key-id={keyId}>
        <Key
          keyId={keyId}
          mode="edit"
          keyDetail={keyDetail}
          updateKeyAction={updateKey}
          decryptKeyAction={decryptKey}
          patchKeyDraftAction={patchKeyDraft}
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
          resourceType="key"
          redirectPath="/system/keys"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DecryptKeyIn,
  DecryptKeyOut,
  KeyDetailIn,
  KeyDetailOut,
  PatchKeyDraftIn,
  PatchKeyDraftOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
