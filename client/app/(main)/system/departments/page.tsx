/**
 * app/(main)/management/departments/page.tsx
 * Departments list page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { auth } from "@/auth";
import Departments from "@/components/departments/Departments";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type DepartmentsListIn = InputOf<"/api/v3/departments/list", "post">;
type DepartmentsListOut = OutputOf<"/api/v3/departments/list", "post">;
type DuplicateDepartmentIn = InputOf<"/api/v3/departments/duplicate", "post">;
type DuplicateDepartmentOut = OutputOf<"/api/v3/departments/duplicate", "post">;
type DeleteDepartmentIn = InputOf<"/api/v3/departments/delete", "post">;
type DeleteDepartmentOut = OutputOf<"/api/v3/departments/delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getDepartmentsList = cache(
  async (input: DepartmentsListIn): Promise<DepartmentsListOut> => {
    return api.post("/departments/list", input);
  },
);

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function duplicateDepartment(
  input: DuplicateDepartmentIn,
): Promise<DuplicateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/duplicate", input);
  revalidateTag("departments");
  return out;
}

export async function deleteDepartment(
  input: DeleteDepartmentIn,
): Promise<DeleteDepartmentOut> {
  "use server";
  const out = await api.post("/departments/delete", input);
  revalidateTag("departments");
  return out;
}

export const metadata: Metadata = {
  title: "Departments",
  description: `Departments in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function DepartmentsPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getDepartmentsList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
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
