/**
 * app/(main)/system/departments/new/page.tsx
 * New department page for the departments section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type DepartmentNewIn = InputOf<"/api/v4/departments/new", "post">;
type DepartmentNewOut = OutputOf<"/api/v4/departments/new", "post">;

type CreateDepartmentIn = InputOf<"/api/v4/departments/create", "post">;
type CreateDepartmentOut = OutputOf<"/api/v4/departments/create", "post">;

type PatchDepartmentDraftIn = InputOf<"/api/v4/departments/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/api/v4/departments/draft", "patch">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartmentDefault = cache(
  async (input: DepartmentNewIn): Promise<DepartmentNewOut> => {
    return api.post("/departments/new", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    });
  }
);

/** ---- Strongly-typed server actions ---- */
async function createDepartment(
  input: CreateDepartmentIn
): Promise<CreateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/create", input);
  // No revalidateTag needed - Redis cache handles invalidation
  return out;
}

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/departments/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Department",
    description:
      "Create a new academic department for teaching assistant training programs. Set up department-specific configurations, organize teaching staff, and coordinate L&D programs across different academic units.",
  };
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control is handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
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

  // Inline server-side parsers for department search params
  const departmentSearchParams = {
    draftId: parseAsString,
  };
  const loadDepartmentSearchParams = createLoader(departmentSearchParams);
  const q = loadDepartmentSearchParams(searchParamsObj);

  // Fetch default department detail server-side with draft_id
  const input: DepartmentNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as DepartmentNewIn["body"],
  };
  const departmentDetailDefault = await getDepartmentDefault(input);

  return (
    <div className="space-y-6">
      <Department
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        departmentDetailDefault={departmentDetailDefault}
        createDepartmentAction={createDepartment}
        patchDepartmentDraftAction={patchDepartmentDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewIn,
  DepartmentNewOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
};
