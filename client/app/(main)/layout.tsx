/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { getSession } from "@/auth";
import { AppShell } from "@/components/common/layout/AppShell";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { checkRouteAccess } from "@/lib/auth-helpers";
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

  // Check route access server-side
  const accessResult = await checkRouteAccess(pathname, session);

  // If access denied, handle based on reason
  if (!accessResult.allowed) {
    const reason = accessResult.reason || "route-denied";

    // If user is not logged in at all, show full-width access denied (no sidebar)
    // But check if logout is in progress to avoid flash
    if (reason === "not-logged-in") {
      return (
        <LogoutGuard>
          <UnifiedAccessDenied
            reason={reason}
            pathname={pathname}
            fullWidth={true}
            {...(accessResult.role && { role: accessResult.role })}
          />
        </LogoutGuard>
      );
    }

    // Otherwise (route-denied or department), user is logged in (including guests)
    // Fetch layout data and show access denied inside sidebar
    const { profileData, settingsData, pageData, snapshot, attemptData, drafts, analyticsFilters } =
      await getLayoutContextData(session);

    return (
      <div
        key={`access-denied-wrapper-${pathname}`}
        data-route-pathname={pathname}
        data-access-state="denied"
      >
        <MainLayoutClient
          key={`access-denied-${pathname}-${reason}`}
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
          <UnifiedAccessDenied
            key={`access-denied-content-${pathname}-${reason}`}
            reason={reason}
            pathname={pathname}
            {...(accessResult.role && { role: accessResult.role })}
          />
        </MainLayoutClient>
      </div>
    );
  }

  // User has access, proceed with layout data fetching
  const { profileData, settingsData, pageData, snapshot, attemptData, drafts, analyticsFilters } =
    await getLayoutContextData(session);

  // If profile resolution failed, show access denied
  if (!profileData || !profileData.id) {
    const reason = session?.user?.profileId
      ? "not-logged-in"
      : "not-logged-in";
    return (
      <LogoutGuard>
        <UnifiedAccessDenied
          key={`invalid-session-${pathname}`}
          reason={reason}
          pathname={pathname}
          fullWidth={true}
        />
      </LogoutGuard>
    );
  }

  // Server-driven route access: check page_access from page response
  if (pageData?.page_access && !pageData.page_access.authorized) {
    return (
      <div
        key={`page-access-denied-wrapper-${pathname}`}
        data-route-pathname={pathname}
        data-access-state="denied"
      >
        <MainLayoutClient
          key={`page-access-denied-${pathname}`}
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
          <UnifiedAccessDenied
            key={`page-access-denied-content-${pathname}`}
            reason="route-denied"
            pathname={pathname}
            role={profileData.role ?? undefined}
          />
        </MainLayoutClient>
      </div>
    );
  }

  return (
    <div
      key={`allowed-wrapper-${pathname}`}
      data-route-pathname={pathname}
      data-access-state="allowed"
    >
      <MainLayoutClient
        key={`allowed-${pathname}`}
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
        {/* Only the PAGE AREA suspends */}
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
