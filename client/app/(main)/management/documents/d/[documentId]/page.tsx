/**
 * app/(main)/management/documents/d/[documentId]/page.tsx
 * Document edit page
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import Document from "@/components/documents/Document";
import type { TemplateSchema } from "@/components/documents/TemplateForm";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToTemplateArgs } from "@/utils/template-args-url";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DocumentDetailIn = InputOf<"/api/v3/documents/detail", "post">;
type DocumentDetailOut = OutputOf<"/api/v3/documents/detail", "post">;
type UpdateDocumentIn = InputOf<"/api/v3/documents/update", "post">;
type UpdateDocumentOut = OutputOf<"/api/v3/documents/update", "post">;
type RenderTemplateIn = InputOf<"/api/v3/documents/render", "post">;
type RenderTemplateOut = OutputOf<"/api/v3/documents/render", "post">;

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

async function renderTemplate(
  input: RenderTemplateIn
): Promise<RenderTemplateOut> {
  "use server";
  return api.post("/documents/render", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch document detail (always fresh - source of truth)
  try {
    const documentDetail = await getDocument(documentId, profileId);

    // Parse search params for template args and render server-side if template document
    let renderedHtml: string | null = null;
    if (documentDetail.template === true) {
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

      // Check if there are template arg params
      const templateSchema =
        documentDetail.template_schema as TemplateSchema | null;
      if (templateSchema) {
        const hasTemplateParams = Array.from(searchParamsObj.keys()).some(
          (key) =>
            key.includes(".") ||
            templateSchema.fields.some((f) => f.name === key)
        );

        if (hasTemplateParams) {
          // Extract template args from search params
          const templateArgs = searchParamsToTemplateArgs(
            searchParamsObj,
            templateSchema
          );

          // Call render endpoint server-side
          try {
            const renderResult = await renderTemplate({
              body: {
                documentId,
                templateArgs,
                profileId,
              },
            });
            renderedHtml = renderResult.rendered_html;
          } catch (error) {
            // If rendering fails, renderedHtml stays null
            // Component will handle this gracefully
            console.error("Failed to render template:", error);
          }
        }
      }
    }

    return (
      <div
        className="space-y-6"
        data-page="document-edit"
        data-document-id={documentId}
      >
        <Document
          documentId={documentId}
          mode="edit"
          documentDetail={documentDetail}
          updateDocumentAction={updateDocument}
          renderedHtml={renderedHtml}
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
  RenderTemplateIn,
  RenderTemplateOut,
  UpdateDocumentIn,
  UpdateDocumentOut,
};
