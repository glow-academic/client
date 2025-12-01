/**
 * app/(main)/management/documents/d/[documentId]/page.tsx
 * Document edit page
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import DocumentEdit from "@/components/documents/DocumentEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DocumentDetailIn = InputOf<"/api/v3/documents/detail", "post">;
type DocumentDetailOut = OutputOf<"/api/v3/documents/detail", "post">;
type UpdateDocumentIn = InputOf<"/api/v3/documents/update", "post">;
type UpdateDocumentOut = OutputOf<"/api/v3/documents/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getDocument = async (
  documentId: string,
  profileId: string
): Promise<DocumentDetailOut> => {
  return api.post(
    "/documents/detail",
    { body: { documentId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ documentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { documentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch active settings for organization name and description
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

  try {
    const document = await getDocument(documentId, profileId);
    return {
      title: `${document?.name || "Document"}`,
      description: `${document ? `${document.name}` : "Document"} in GLOW${orgPart}.`,
    };
  } catch {
    return {
      title: "Document",
      description: `Document in GLOW${orgPart}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateDocument(
  input: UpdateDocumentIn
): Promise<UpdateDocumentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DocumentEditPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch document detail (always fresh - source of truth)
  try {
    const documentDetail = await getDocument(documentId, profileId);

    return (
      <div
        className="space-y-6"
        data-page="document-edit"
        data-document-id={documentId}
      >
        <DocumentEdit
          documentId={documentId}
          documentDetail={documentDetail}
          updateDocumentAction={updateDocument}
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
        <DepartmentAccessDenied
          resourceType="document"
          redirectPath="/management/documents"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DocumentDetailIn,
  DocumentDetailOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
};

