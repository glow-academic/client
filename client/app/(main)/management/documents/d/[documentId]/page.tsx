/**
 * app/(main)/management/documents/d/[documentId]/page.tsx
 * Document edit page
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import NewDocument from "@/components/documents/NewDocument";
import type { TemplateSchema } from "@/components/documents/TemplateForm";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToTemplateArgs } from "@/utils/template-args-url";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetDocumentIn = InputOf<"/api/v4/documents/get", "post">;
type GetDocumentOut = OutputOf<"/api/v4/documents/get", "post">;
type SaveDocumentIn = InputOf<"/api/v4/documents/save", "post">;
type SaveDocumentOut = OutputOf<"/api/v4/documents/save", "post">;
// Note: _render endpoint returns dict[str, Any], not a typed response
type RenderTemplateIn = {
  body: {
    document_id: string;
    template_args: Record<string, unknown>;
    department_ids?: string[] | null;
  };
};
type RenderTemplateOut = {
  rendered_html: string;
};
type PatchDocumentDraftIn = InputOf<"/api/v4/documents/draft", "patch">;
type PatchDocumentDraftOut = OutputOf<"/api/v4/documents/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftDepartmentsIn = InputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftDepartmentsOut = OutputOf<
  "/api/v4/resources/departments",
  "post"
>;
type CreateDraftFieldsIn = InputOf<"/api/v4/resources/fields", "post">;
type CreateDraftFieldsOut = OutputOf<"/api/v4/resources/fields", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDocumentDefault = async (
  input: GetDocumentIn
): Promise<GetDocumentOut> => {
  return api.post("/documents/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ documentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { documentId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const document = await getDocumentDefault({
      body: { document_id: documentId, draft_id: null },
    });
    const documentName = document?.name_resource?.name;
    return {
      title: `${documentName || "Document"}`,
      description: `${documentName ? `${documentName} - ` : ""}Learning resource and educational document for teaching assistant training. Access course materials, instructional resources, and reference documents to support pedagogical development.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Document",
    description:
      "Learning resource and educational document for teaching assistant training. Access course materials, instructional resources, and reference documents to support pedagogical development.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveDocument(input: SaveDocumentIn): Promise<SaveDocumentOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/documents/save", input);
}

async function renderTemplate(
  input: RenderTemplateIn
): Promise<RenderTemplateOut> {
  "use server";
  // _render endpoint is not in OpenAPI schema, use type assertion for endpoint path
  const result = await (api.post as (path: string, input: RenderTemplateIn) => Promise<Record<string, unknown>>)("/documents/_render", input);
  // API returns dict[str, Any], assert to our expected type
  return result as RenderTemplateOut;
}

async function patchDocumentDraft(
  input: PatchDocumentDraftIn
): Promise<PatchDocumentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/documents/draft", input);
}

// generateTemplate removed - component now uses WebSocket directly

/** ---- Server renders client with typed data and actions ---- */
export default async function DocumentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Inline server-side parsers for document search params (draftId only)
  const documentSearchParams = {
    draftId: parseAsString,
  };
  const loadDocumentSearchParams = createLoader(documentSearchParams);
  const q = loadDocumentSearchParams(searchParamsObj);

  // Fetch document detail (always fresh - source of truth) with draft_id
  try {
    const documentDetail = await getDocument(documentId, q.draftId ?? null);

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

      // Check if there are template arg params (JSON format)
      // Use template_schema from API response, fallback to template_args for backward compatibility
      // Note: template_schema is added dynamically by the API, so we need type assertion
      const docDetail = documentDetail as GetDocumentOut & { template_schema?: TemplateSchema | null; template_args?: TemplateSchema | null };
      const templateSchema =
        (docDetail.template_schema as TemplateSchema | null) ||
        (docDetail.template_args as TemplateSchema | null);
      if (templateSchema) {
        const hasTemplateParams = searchParamsObj.has("templateArgs");

        if (hasTemplateParams) {
          // Extract template args from search params
          const templateArgs = searchParamsToTemplateArgs(
            searchParamsObj,
            templateSchema
          );

          // Call render endpoint server-side
          // Use first departmentId from document for department-specific theme
          const departmentIds =
            documentDetail.department_ids &&
            documentDetail.department_ids.length > 0
              ? documentDetail.department_ids
              : undefined;

          try {
            const renderResult = (await renderTemplate({
              body: {
                document_id: documentId,
                template_args: templateArgs,
                ...(departmentIds !== undefined && {
                  department_ids: departmentIds || null,
                }),
              },
            })) as unknown as RenderTemplateOut;
            renderedHtml = renderResult.rendered_html;
          } catch (error) {
            // If rendering fails, renderedHtml stays null
            // Component will handle this gracefully
            // eslint-disable-next-line no-console
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
        <NewDocument
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          documentId={documentId}
          documentData={documentDetail}
          saveDocumentAction={saveDocument}
          patchDocumentDraftAction={patchDocumentDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createFlagsAction={createDraftFlags}
          createFieldsAction={createDraftFields}
          createDepartmentsAction={createDraftDepartments}
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
          resourceType="document"
          redirectPath="/management/documents"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

// Types are now defined inline in components using InputOf/OutputOf
