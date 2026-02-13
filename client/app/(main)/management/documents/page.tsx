/**
 * app/(main)/management/documents/page.tsx
 * Documents list page - redirects to home with documents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Documents from "@/components/artifacts/document/Documents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DocumentsListIn = InputOf<"/api/v4/artifacts/documents/list", "post">;
type DocumentsListOut = OutputOf<"/api/v4/artifacts/documents/list", "post">;
type DeleteDocumentIn = InputOf<"/api/v4/artifacts/documents/delete", "post">;
type DeleteDocumentOut = OutputOf<"/api/v4/artifacts/documents/delete", "post">;
// GenerateTemplate types removed - now using WebSocket
type GenerateTemplateIn = never;
type GenerateTemplateOut = never;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDocumentsList = async (): Promise<DocumentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/documents/list",
    { body: {} },
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
  return api.post("/artifacts/documents/delete", input);
}

// generateTemplate removed - component now uses WebSocket directly

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/documents/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/documents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/documents/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

export default async function DocumentsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getDocumentsList();

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
