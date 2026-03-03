/**
 * app/(main)/system/departments/page.tsx
 * Departments list page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Departments from "@/components/artifacts/department/Departments";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type DepartmentsListOut = OutputOf<"/api/v5/artifacts/departments/list", "post">;
type DuplicateDepartmentIn = InputOf<"/api/v5/artifacts/departments/duplicate", "post">;
type DuplicateDepartmentOut = OutputOf<"/api/v5/artifacts/departments/duplicate", "post">;
type DeleteDepartmentIn = InputOf<"/api/v5/artifacts/departments/delete", "post">;
type DeleteDepartmentOut = OutputOf<"/api/v5/artifacts/departments/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDepartmentsList = async (): Promise<DepartmentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/departments/list",
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
async function duplicateDepartment(
  input: DuplicateDepartmentIn,
): Promise<DuplicateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/departments/duplicate", input);
}

async function deleteDepartment(
  input: DeleteDepartmentIn,
): Promise<DeleteDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/departments/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/departments/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/departments/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/departments/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

export default async function DepartmentsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getDepartmentsList();

  return (
    <div className="space-y-6" data-page="departments-index">
      <Departments
        listData={listData}
        duplicateDepartmentAction={duplicateDepartment}
        deleteDepartmentAction={deleteDepartment}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
};
