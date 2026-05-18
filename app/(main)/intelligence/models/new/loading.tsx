import { cookies } from "next/headers";
import { FullPageSkeleton } from "@/components/common/layout/FullPageSkeleton";
import { FormSkeleton } from "@/components/common/forms/FormSkeleton";

export default async function Loading() {
  const cookieStore = await cookies();
  const sidebarOpen = cookieStore.get("glow_sidebar")?.value !== "false";
  const panelOpen = cookieStore.get("glow_panel")?.value === "true";

  return (
    <FullPageSkeleton sidebarOpen={sidebarOpen} panelOpen={panelOpen}>
      <FormSkeleton steps={8} />
    </FullPageSkeleton>
  );
}
