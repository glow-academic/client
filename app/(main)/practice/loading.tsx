/**
 * app/(main)/practice/loading.tsx
 * Loading skeleton for practice page
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { PracticeSkeleton } from "@/components/artifacts/practice/Practice";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <PracticeSkeleton />
    </FullPageSkeleton>
  );
}
