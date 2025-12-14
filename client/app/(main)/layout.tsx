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
import { headers } from "next/headers";
import { Suspense } from "react";
import { MainLayoutClient } from "./layout-client";
import {
  bulkCreateOrUpdateStaff,
  createFeedback,
  getCreateStaffData,
  getLayoutContextData,
  processCSV,
  refreshAnalytics,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

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
    const { initial, snapshot, attemptData, activeSettings } =
      await getLayoutContextData();

    return (
      <div
        key={`access-denied-wrapper-${pathname}`}
        data-route-pathname={pathname}
        data-access-state="denied"
      >
        <MainLayoutClient
          key={`access-denied-${pathname}-${reason}`}
          initial={initial}
          sessionSnapshot={snapshot}
          attemptData={attemptData}
          activeSettings={activeSettings}
          switchEffectiveProfileAction={switchEffectiveProfile}
          createFeedbackAction={createFeedback}
          refreshAnalyticsAction={refreshAnalytics}
          searchSimulatableProfilesAction={searchSimulatableProfiles}
          processCSVAction={processCSV}
          bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
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
  const { initial, snapshot, attemptData, activeSettings } =
    await getLayoutContextData();

  // If profile resolution failed, show access denied
  // This can happen if:
  // 1. Cookies are invalid (guest/default-account users)
  // 2. Session has invalid profile ID (profile doesn't exist in database)
  // 3. Database was reset but session still has old profile IDs
  if (!initial || !initial.effectiveProfile?.id || !initial.actualProfile?.id) {
    // If we have a session but profile resolution failed, the session is invalid
    // Show access denied with "not-logged-in" reason to prompt re-authentication
    const reason = session?.effectiveProfileId
      ? "not-logged-in" // Invalid session - profile doesn't exist
      : "not-logged-in"; // No session at all
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

  // Check if we're on the staff page and fetch initial data if needed
  const profileId =
    session?.effectiveProfileId || initial?.effectiveProfile.id || null;
  const isStaffPage = pathname === "/management/staff";

  let initialCreateStaffData = null;

  if (isStaffPage && profileId) {
    try {
      initialCreateStaffData = await getCreateStaffData({
        body: {
          departmentIds: [],
          profileId,
        },
      });
    } catch {
      // If fetch fails, continue without staff data
      // This can happen if user doesn't have access
    }
  }

  return (
    <div
      key={`allowed-wrapper-${pathname}`}
      data-route-pathname={pathname}
      data-access-state="allowed"
    >
      <MainLayoutClient
        key={`allowed-${pathname}`}
        initial={initial}
        sessionSnapshot={snapshot}
        attemptData={attemptData}
        activeSettings={activeSettings}
        switchEffectiveProfileAction={switchEffectiveProfile}
        createFeedbackAction={createFeedback}
        refreshAnalyticsAction={refreshAnalytics}
        searchSimulatableProfilesAction={searchSimulatableProfiles}
        processCSVAction={processCSV}
        bulkCreateOrUpdateStaffAction={bulkCreateOrUpdateStaff}
        initialCreateStaffData={initialCreateStaffData}
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
