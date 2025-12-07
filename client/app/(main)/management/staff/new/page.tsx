/**
 * app/(main)/management/staff/new/page.tsx
 * Staff new page for creating a new staff member.
 * @AshokSaravanan222
 * 12/04/2025
 */

import { getSession } from "@/auth";

import StaffNewEdit from "@/components/staff/StaffNewEdit";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type StaffNewIn = InputOf<"/api/v3/profile/staff/new", "post">;
type StaffNewOut = OutputOf<"/api/v3/profile/staff/new", "post">;
type CreateStaffIn = InputOf<"/api/v3/profile/staff/create", "post">;
type CreateStaffOut = OutputOf<"/api/v3/profile/staff/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getStaffNew = cache(
  async (profileId: string): Promise<StaffNewOut> => {
    return api.post(
      "/profile/staff/new",
      { body: { profileId } },
      {
        cache: "no-store",
        headers: {
          "X-Bypass-Cache": "1",
        },
      }
    );
  }
);

/** ---- Strongly-typed server actions ---- */
async function createStaff(input: CreateStaffIn): Promise<CreateStaffOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  return api.post("/profile/staff/create", {
    body: { ...input.body, profileId },
  });
}

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Staff",
    description: "Add a new teaching staff member to the training platform. Create staff profiles, assign roles and permissions, and configure access to learning cohorts and educational resources for teaching assistant development programs.",
  };
}
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewStaffPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default staff detail server-side
  const staffDetailDefault = await getStaffNew(profileId);

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

