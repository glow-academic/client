/**
 * app/(main)/system/keys/k/[keyId]/page.tsx
 * Key editing page
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Key from "@/components/keys/Key";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeyDetailIn = InputOf<"/api/v3/keys/detail", "post">;
type KeyDetailOut = OutputOf<"/api/v3/keys/detail", "post">;

type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;

type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getKey = async (
  keyId: string,
  profileId: string,
): Promise<KeyDetailOut> => {
  return api.post(
    "/keys/detail",
    { body: { keyId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ keyId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { keyId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const key = await getKey(keyId, profileId);
      return {
        title: `${key?.name || "Key"}`,
        description: `${key?.name ? `${key.name} - ` : ""}API key configuration for teaching assistant training platform. Manage secure access credentials and API integrations for educational institutions and L&D programs.`,
      };
    } catch {
      // Fall through to default metadata
    }
  }

  return {
    title: "Key",
    description:
      "API key configuration for teaching assistant training platform. Manage secure access credentials and API integrations for educational institutions and L&D programs.",
  };
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditKeyPage({
  params,
}: {
  params: Promise<{ keyId: string }>;
}) {
  const { keyId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch data for edit mode
  try {
    const keyDetail = await getKey(keyId, profileId).catch(() => null);

    if (!keyDetail) {
      throw new Error("Key not found");
    }

    return (
      <div className="space-y-6" data-page="key-edit" data-key-id={keyId}>
        <Key
          keyId={keyId}
          keyDetail={keyDetail}
          updateKeyAction={updateKey}
          decryptKeyAction={decryptKey}
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/update", {
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

/** ---- Export types for client component (type-only imports) ---- */
export type {
  KeyDetailIn,
  KeyDetailOut,
  UpdateKeyIn,
  UpdateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
};
