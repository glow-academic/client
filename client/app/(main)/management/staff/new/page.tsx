/**
 * app/(main)/management/staff/new/page.tsx
 * Staff new page for creating a new staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import StaffNewEdit from "@/components/staff/StaffNewEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type StaffNewOut = OutputOf<"/api/v4/profile/new", "post">;
type CreateStaffIn = InputOf<"/api/v4/profile/create", "post">;
type CreateStaffOut = OutputOf<"/api/v4/profile/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getStaffNew = cache(async (): Promise<StaffNewOut> => {
  return api.post(
    "/profile/new",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
});

/** ---- Strongly-typed server actions ---- */
async function createStaff(input: CreateStaffIn): Promise<CreateStaffOut> {
  "use server";

  return api.post("/profile/create", {
    body: { ...input.body },
  });
}

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Staff",
    description:
      "Add a new teaching staff member to the training platform. Create staff profiles, assign roles and permissions, and configure access to learning cohorts and educational resources for teaching assistant development programs.",
  };
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewStaffPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch default staff detail server-side
  const staffDetailDefault = await getStaffNew();

  return (
    <div
      className="space-y-6"
      data-page="staff-new"
      aria-label="Create new staff page"
    >
      <StaffNewEdit
        mode="create"
        staffDetailDefault={staffDetailDefault}
        createStaffAction={createStaff}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateStaffIn, CreateStaffOut, StaffNewOut };
