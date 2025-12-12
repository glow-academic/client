/**
 * app/(main)/departments/new/page.tsx
 * New department page for the departments section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";
import { cache } from "react";

import type { InputOf, OutputOf } from "@/lib/api/types";

/** ---- Strong types from OpenAPI ---- */
type DepartmentNewIn = InputOf<"/api/v3/departments/new", "post">;
type DepartmentNewOut = OutputOf<"/api/v3/departments/new", "post">;

type CreateDepartmentIn = InputOf<"/api/v3/departments/create", "post">;
type CreateDepartmentOut = OutputOf<"/api/v3/departments/create", "post">;
/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartmentDefault = cache(
  async (input: DepartmentNewIn): Promise<DepartmentNewOut> => {
    return api.post("/departments/new", input);
  },
);

/** ---- Strongly-typed server actions ---- */
async function createDepartment(
  input: CreateDepartmentIn,
): Promise<CreateDepartmentOut> {
  "use server";
  const out = await api.post("/departments/create", input);
  // No revalidateTag needed - Redis cache handles invalidation
  return out;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Department",
    description: "Create a new academic department for teaching assistant training programs. Set up department-specific configurations, organize teaching staff, and coordinate L&D programs across different academic units.",
  };
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewDepartmentPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default department detail server-side
  const departmentDetailDefault = await getDepartmentDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Department
        departmentDetailDefault={departmentDetailDefault}
        createDepartmentAction={createDepartment}
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
};
