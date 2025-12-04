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
type DepartmentNewIn = InputOf<
  "/api/v3/departments/new",
  "post"
>;
type DepartmentNewOut = OutputOf<
  "/api/v3/departments/new",
  "post"
>;

type CreateDepartmentIn = InputOf<"/api/v3/departments/create", "post">;
type CreateDepartmentOut = OutputOf<"/api/v3/departments/create", "post">;
type DepartmentSearchProfileIn = InputOf<
  "/api/v3/departments/search-profile",
  "post"
>;
type DepartmentSearchProfileOut = OutputOf<
  "/api/v3/departments/search-profile",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getDepartmentDefault = cache(
  async (
    input: DepartmentNewIn,
  ): Promise<DepartmentNewOut> => {
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

async function searchDepartmentProfile(
  input: DepartmentSearchProfileIn,
): Promise<DepartmentSearchProfileOut> {
  "use server";
  return api.post("/departments/search-profile", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

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

  return {
    title: "New Department",
    description: `New department creation page for the departments section in GLOW${orgPart}.`,
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
        searchAddStaff={searchDepartmentProfile}
      />
    </div>
  );
}

/** ---- Derived types from server responses ---- */
type DepartmentDefaultStaffItem =
  DepartmentNewOut["staff"][number];

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDepartmentIn,
  CreateDepartmentOut,
  DepartmentNewIn,
  DepartmentNewOut,
  DepartmentDefaultStaffItem,
};
