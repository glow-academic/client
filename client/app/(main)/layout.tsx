/**
 * app/(main)/layout.tsx
 * Layout for the main section.
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
  getLayoutContextData,
  refreshPage,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

const AUTOSAVE_COOKIE = "glow_autosave";

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

  // Read autosave preference from cookie for SSR
  const cookieStore = await cookies();
  const autosaveCookie = cookieStore.get(AUTOSAVE_COOKIE);
  const initialAutosave = autosaveCookie
    ? autosaveCookie.value === "true"
    : undefined;

  // No session → full-width access denied (no sidebar)
  if (!session?.user?.profileId) {
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

  // Fetch all layout data in parallel
  const { profileData, settingsData, pageData, snapshot, attemptData, drafts, analyticsFilters } =
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

  // Determine page content: access denied (inside sidebar) or normal page
  const pageAccessDenied = pageData?.page_access && !pageData.page_access.authorized;

  return (
    <div
      key={`layout-wrapper-${pathname}`}
      data-route-pathname={pathname}
      data-access-state={pageAccessDenied ? "denied" : "allowed"}
    >
      <MainLayoutClient
        key={`layout-${pathname}`}
        profileData={profileData}
        settingsData={settingsData}
        pageData={pageData}
        sessionSnapshot={snapshot}
        attemptData={attemptData}
        drafts={drafts}
        analyticsFilters={analyticsFilters}
        initialAutosave={initialAutosave}
        switchEffectiveProfileAction={switchEffectiveProfile}
        createFeedbackAction={createFeedback}
        refreshPageAction={refreshPage}
        searchSimulatableProfilesAction={searchSimulatableProfiles}
      >
        {pageAccessDenied ? (
          <UnifiedAccessDenied
            reason="route-denied"
            pathname={pathname}
            role={profileData.role ?? undefined}
          />
        ) : (
          <Suspense
            key={`suspense-${pathname}`}
            fallback={<AppShell.ContentSkeleton />}
          >
            {children}
          </Suspense>
        )}
      </MainLayoutClient>
    </div>
  );
}
