/**
 * app/(main)/system/departments/new/page.tsx
 * New department page for the departments section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Department from "@/components/departments/Department";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Departments",
  description: `Create new AI departments in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewDepartmentPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch default department detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.departments.with({ profileId }),
    queryFn: () =>
      api.post("/departments/detail-default", {
        body: { profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Department />
      </div>
    </HydrationBoundary>
  );
}
