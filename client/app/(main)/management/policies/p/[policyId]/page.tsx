/**
 * app/(main)/management/policies/p/[policyId]/page.tsx
 * Edit policy page with server actions
 * @AshokSaravanan222 & @siladiea
 * 12/24/2024
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import Policy from "@/components/policies/Policy";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { PoliciesListOut } from "@/app/(main)/management/policies/page";

/** ---- Strong types from OpenAPI ---- */
type PolicyDetailIn = InputOf<"/api/v3/policies/detail", "post">;
type PolicyDetailOut = OutputOf<"/api/v3/policies/detail", "post">;
type CreatePolicyIn = InputOf<"/api/v3/policies/create", "post">;
type CreatePolicyOut = OutputOf<"/api/v3/policies/create", "post">;
type UpdatePolicyIn = InputOf<"/api/v3/policies/update", "post">;
type UpdatePolicyOut = OutputOf<"/api/v3/policies/update", "post">;
type FinalizePolicyUploadIn = InputOf<
  "/api/v3/policies/upload/finalize",
  "post"
>;
type FinalizePolicyUploadOut = OutputOf<
  "/api/v3/policies/upload/finalize",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getPolicy = async (input: PolicyDetailIn): Promise<PolicyDetailOut> => {
  return api.post("/policies/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createPolicy(input: CreatePolicyIn): Promise<CreatePolicyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/policies/create", input);
}

async function updatePolicy(input: UpdatePolicyIn): Promise<UpdatePolicyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/policies/update", input);
}

async function finalizePolicyUpload(
  input: FinalizePolicyUploadIn
): Promise<FinalizePolicyUploadOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/policies/upload/finalize", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ policyId: string }>;
}) {
  const { policyId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Handle "new" route
  if (policyId === "new") {
    // Fetch list to get valid department IDs and mapping
    const listData = await api.post<PoliciesListOut>(
      "/policies/list",
      { body: { profileId } },
      {
        cache: "no-store",
        headers: {
          "X-Bypass-Cache": "1",
        },
      }
    );

    const validDepartmentIds = Object.keys(listData.department_mapping || {});
    const policyDetailDefault: PolicyDetailOut = {
      name: "",
      description: "",
      file_path: "",
      mime_type: "",
      active: true,
      created_at: "",
      updated_at: "",
      department_ids: null,
      valid_department_ids: validDepartmentIds,
      can_edit: true,
      can_delete: false,
      department_mapping: listData.department_mapping || {},
    };

    return (
      <div
        className="space-y-6"
        data-page="policy-create"
        data-policy-id="new"
      >
        <Policy
          mode="create"
          policyDetailDefault={policyDetailDefault}
          createPolicyAction={createPolicy}
          finalizePolicyUploadAction={finalizePolicyUpload}
        />
      </div>
    );
  }

  // Fetch policy detail (always fresh - source of truth)
  try {
    const policyDetail = await getPolicy({
      body: { policyId, profileId },
    });

    return (
      <div
        className="space-y-6"
        data-page="policy-edit"
        data-policy-id={policyId}
      >
        <Policy
          policyId={policyId}
          mode="edit"
          policyDetail={policyDetail}
          createPolicyAction={createPolicy}
          updatePolicyAction={updatePolicy}
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
        <DepartmentAccessDenied
          resourceType="policy"
          redirectPath="/management/policies"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreatePolicyIn,
  CreatePolicyOut,
  UpdatePolicyIn,
  UpdatePolicyOut,
  FinalizePolicyUploadIn,
  FinalizePolicyUploadOut,
  PolicyDetailIn,
  PolicyDetailOut,
};

