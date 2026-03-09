/**
 * app/(main)/layout.tsx
 * Layout for the main section — provides sidebar + global providers (profile, settings, socket, theme).
 * Page-level concerns (drafts, group, analytics filters, toolbars) are owned by each page.
 * Pages render their own headers via <PageHeader>.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { getSession } from "@/auth";
import { AppShell } from "@/components/common/layout/AppShell";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { cookies, headers } from "next/headers";
import { Suspense } from "react";
import { MainLayoutClient } from "./layout-client";
import {
  createFeedback,
  exitEmulation,
  getLayoutContextData,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

const SIDEBAR_COOKIE = "glow_sidebar";

// Force dynamic rendering to ensure layout re-renders on route changes
// This fixes the issue where children don't update on client-side navigation
export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();

  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie
    ? sidebarCookie.value === "true"
    : undefined;

  // No session → full-width access denied (no sidebar)
  if (!session?.id_token) {
    return (
      <LogoutGuard>
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={pathname}
          fullWidth={true}
        />
      </LogoutGuard>
    );
  }

  // Fetch global layout data (profile + settings only)
  const { profileData, settingsData, snapshot } =
    await getLayoutContextData(session);

  // Profile resolution failed → full-width access denied
  if (!profileData?.id) {
    return (
      <LogoutGuard>
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={pathname}
          fullWidth={true}
        />
      </LogoutGuard>
    );
  }

  return (
    <div
      key={`layout-wrapper-${pathname}`}
      data-route-pathname={pathname}
    >
      <MainLayoutClient
        key={`layout-${pathname}`}
        profileData={profileData}
        settingsData={settingsData}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        switchEffectiveProfileAction={switchEffectiveProfile}
        exitEmulationAction={exitEmulation}
        createFeedbackAction={createFeedback}
        searchSimulatableProfilesAction={searchSimulatableProfiles}
      >
        <Suspense
          key={`suspense-${pathname}`}
          fallback={<AppShell.ContentSkeleton />}
        >
          {children}
        </Suspense>
      </MainLayoutClient>
    </div>
  );
}
