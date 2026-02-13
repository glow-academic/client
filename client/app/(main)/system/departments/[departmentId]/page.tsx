/**
 * app/(main)/system/departments/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Department from "@/components/artifacts/department/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetDepartmentIn = InputOf<"/api/v4/artifacts/departments/get", "post">;
type GetDepartmentOut = OutputOf<"/api/v4/artifacts/departments/get", "post">;
type SaveDepartmentIn = InputOf<"/api/v4/artifacts/departments/save", "post">;
type SaveDepartmentOut = OutputOf<"/api/v4/artifacts/departments/save", "post">;
type PatchDepartmentDraftIn = InputOf<"/api/v4/artifacts/departments/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/api/v4/artifacts/departments/draft", "patch">;
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDepartment = async (
  input: GetDepartmentIn
): Promise<GetDepartmentOut> => {
  return api.post("/artifacts/departments/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/departments/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/departments/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/departments/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}): Promise<Metadata> {
  const { departmentId } = await params;
  const docs = await getDocs({ body: { entity_id: departmentId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions ---- */
async function saveDepartment(
  input: SaveDepartmentIn
): Promise<SaveDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/departments/save", input);
}

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/departments/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { departmentId } = await params;

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

  // Inline server-side parsers for department search params
  const departmentSearchParams = {
    draftId: parseAsString,
  };
  const loadDepartmentSearchParams = createLoader(departmentSearchParams);
  const q = loadDepartmentSearchParams(searchParamsObj);

  // Fetch department detail (always fresh - source of truth) with draft_id (unified get endpoint)
  try {
    const input: GetDepartmentIn = {
      body: {
        department_id: departmentId,
        draft_id: q.draftId ?? null,
      } as GetDepartmentIn["body"],
    };
    const departmentDetail = await getDepartment(input);

    return (
      <div
        className="space-y-6"
        data-page="department-edit"
        data-department-id={departmentId}
      >
        <Department
          key={q.draftId || departmentId} // Force remount when draftId changes to ensure clean state reset
          departmentId={departmentId}
          departmentData={departmentDetail}
          saveDepartmentAction={saveDepartment}
          patchDepartmentDraftAction={patchDepartmentDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
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
          resourceType="department"
          redirectPath="/system/departments"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  GetDepartmentIn,
  GetDepartmentOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  SaveDepartmentIn,
  SaveDepartmentOut,
};
