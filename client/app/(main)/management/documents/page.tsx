/**
 * app/(main)/management/documents/page.tsx
 * Documents list page - redirects to home with documents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";

import Documents from "@/components/documents/Documents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/api/v3/documents/list", "post">;
type DocumentsListOut = OutputOf<"/api/v3/documents/list", "post">;
type DeleteDocumentIn = InputOf<"/api/v3/documents/delete", "post">;
type DeleteDocumentOut = OutputOf<"/api/v3/documents/delete", "post">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDocumentsList = async (
  profileId: string,
): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/documents/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteDocument(
  input: DeleteDocumentIn,
): Promise<DeleteDocumentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/delete", input);
}

// generateTemplate removed - component now uses WebSocket directly

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Documents",
    description:
      "Manage learning resources and educational documents for teaching assistant training. Organize course materials, instructional resources, and reference documents to support pedagogical development and L&D program content.",
  };
}

export default async function DocumentsPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getDocumentsList(profileId);

  return (
    <div className="space-y-6" data-page="documents-index">
      <Documents listData={listData} deleteDocumentAction={deleteDocument} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDocumentIn,
  DeleteDocumentOut,
  DocumentsListIn,
  DocumentsListOut,
  GenerateTemplateIn,
  GenerateTemplateOut,
};
