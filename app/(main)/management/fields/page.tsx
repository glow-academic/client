/**
 * app/(main)/management/fields/page.tsx
 * Fields list page
 * @AshokSaravanan222 & @siladiea
 * 12/05/2025
 */
import Fields from "@/components/artifacts/field/Fields";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type FieldsListOut = OutputOf<"/fields/search", "post">;
type DuplicateFieldIn = InputOf<"/fields/duplicate", "post">;
type DuplicateFieldOut = OutputOf<"/fields/duplicate", "post">;
type DeleteFieldIn = InputOf<"/fields/delete", "post">;
type DeleteFieldOut = OutputOf<"/fields/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getFieldsList = async (): Promise<FieldsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/fields/search",
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
async function duplicateField(
  input: DuplicateFieldIn,
): Promise<DuplicateFieldOut> {
  "use server";
  return api.post("/fields/duplicate", input);
}

async function deleteField(input: DeleteFieldIn): Promise<DeleteFieldOut> {
  "use server";
  return api.post("/fields/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/fields/docs", "post">;
type DocsOut = OutputOf<"/fields/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/fields/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
}

export default async function FieldsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getFieldsList();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Fields" },
        ]}
        toolbar={<NewArtifactButton label="New Field" href="/management/fields/new" />}
      />
      <div className="space-y-6 px-4" data-page="fields-index">
        <Fields
          listData={listData}
          duplicateFieldAction={duplicateField}
          deleteFieldAction={deleteField}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  FieldsListOut,
  DeleteFieldIn,
  DeleteFieldOut,
  DuplicateFieldIn,
  DuplicateFieldOut,
};
