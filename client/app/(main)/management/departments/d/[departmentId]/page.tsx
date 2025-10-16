/**
 * app/(main)/management/departments/d/[departmentId]/page.tsx
 * Department edit page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Department from "@/components/common/department/Department";
import { departmentsDetailKeys } from "@/lib/api/v2/keys";
import { fetchDepartmentDetail } from "@/lib/api/v2/server/departments";
import { departmentRepo } from "@/lib/repos/departmentRepo";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ departmentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { departmentId } = await params;
  const department = await departmentRepo.find(departmentId);
  return {
    title: `${department?.title || "Department"} Department`,
    description: `${department?.title + " " + department?.description || "Department"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function DepartmentEditPage({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}) {
  const { departmentId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch department detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: departmentsDetailKeys.detail(departmentId, profileId),
    queryFn: () => fetchDepartmentDetail(departmentId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Department departmentId={departmentId} />
      </div>
    </HydrationBoundary>
  );
}
