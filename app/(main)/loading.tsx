/**
 * app/(main)/loading.tsx
 * Segment-level loading state for (main) route group.
 * Uses FullPageSkeleton with cookie-based sidebar/panel state.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { ContentSkeleton } from "@/components/common/layout/AppShell";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <ContentSkeleton />
    </FullPageSkeleton>
  );
}
