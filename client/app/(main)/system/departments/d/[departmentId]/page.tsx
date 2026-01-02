/**
 * app/(main)/system/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type DepartmentDetailIn = InputOf<"/api/v4/departments/detail", "post">;
type DepartmentDetailOut = OutputOf<"/api/v4/departments/detail", "post">;
type UpdateDepartmentIn = InputOf<"/api/v4/departments/update", "post">;
type UpdateDepartmentOut = OutputOf<"/api/v4/departments/update", "post">;
type PatchDepartmentDraftIn = InputOf<"/api/v4/departments/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/api/v4/departments/draft", "patch">;

type CreateKeyIn = InputOf<"/api/v4/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v4/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v4/keys/decrypt", "post">;
type DecryptKeyOut = OutputOf<"/api/v4/keys/decrypt", "post">;
type UpdateKeyIn = InputOf<"/api/v4/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v4/keys/update", "post">;
type KeysListOut = OutputOf<"/api/v4/keys/list", "post">;
type SettingsDetailOut = OutputOf<"/api/v4/settings/detail", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getDepartment = async (
  input: DepartmentDetailIn
): Promise<DepartmentDetailOut> => {
  return api.post("/departments/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { departmentId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: DepartmentDetailIn = {
      body: {
        department_id: departmentId,
        draft_id: null,
      } as DepartmentDetailIn["body"],
    };
    const department = await getDepartment(input);
    return {
      title: `${department?.title || "Department"} Department`,
      description: `${department?.title ? `${department.title} - ` : ""}Academic department for teaching assistant training programs.${department?.description ? ` ${department.description}` : ""} Manage department-specific settings and coordinate L&D programs across different academic units.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Department",
    description:
      "Academic department for teaching assistant training programs. Manage department-specific settings and coordinate L&D programs across different academic units.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function updateDepartment(
  input: UpdateDepartmentIn
): Promise<UpdateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/departments/update", input);
}

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/departments/draft", input);
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

  // Fetch department detail (always fresh - source of truth) with draft_id
  try {
    const input: DepartmentDetailIn = {
      body: {
        department_id: departmentId,
        draft_id: q.draftId ?? null,
      } as DepartmentDetailIn["body"],
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
          departmentDetail={departmentDetail}
          updateDepartmentAction={updateDepartment}
          patchDepartmentDraftAction={patchDepartmentDraft}
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
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DepartmentDetailIn,
  DepartmentDetailOut,
  KeysListOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  SettingsDetailOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
