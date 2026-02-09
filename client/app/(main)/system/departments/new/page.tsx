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
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftSettingsIn = InputOf<"/api/v4/resources/settings", "post">;
type CreateDraftSettingsOut = OutputOf<"/api/v4/resources/settings", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartmentDefault = cache(
  async (input: GetDepartmentIn): Promise<GetDepartmentOut> => {
    return api.post("/artifacts/departments/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    });
  }
);

/** ---- Strongly-typed server actions ---- */
async function saveDepartment(
  input: SaveDepartmentIn
): Promise<SaveDepartmentOut> {
  "use server";
  const out = await api.post("/artifacts/departments/save", input);
  // No revalidateTag needed - Redis cache handles invalidation
  return out;
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

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  return api.post("/resources/flags", input);
}

async function createDraftSettings(
  input: CreateDraftSettingsIn
): Promise<CreateDraftSettingsOut> {
  "use server";
  return api.post("/resources/settings", input);
}

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/departments/draft", input);
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

  // Fetch default department detail server-side with draft_id (unified get endpoint with department_id = null)
  const input: GetDepartmentIn = {
    body: {
      department_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
    } as GetDepartmentIn["body"],
  };
  const departmentDetailDefault = await getDepartmentDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="department-new"
      aria-label="Create new department page"
    >
      <Department
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        departmentData={departmentDetailDefault}
        saveDepartmentAction={saveDepartment}
        patchDepartmentDraftAction={patchDepartmentDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createFlagsAction={createDraftFlags}
        createSettingsAction={createDraftSettings}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftFlagsIn,
  CreateDraftFlagsOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  CreateDraftSettingsIn,
  CreateDraftSettingsOut,
  GetDepartmentIn,
  GetDepartmentOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  SaveDepartmentIn,
  SaveDepartmentOut,
};
