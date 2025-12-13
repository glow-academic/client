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

  // If access denied, show unified access denied component
  if (!accessResult.allowed) {
    return (
      <UnifiedAccessDenied
        reason={accessResult.reason || "route-denied"}
        pathname={pathname}
        {...(accessResult.role && { role: accessResult.role })}
      />
    );
  }

  // User has access, proceed with layout data fetching
  const { initial, snapshot, attemptData, activeSettings } =
    await getLayoutContextData();

  // Check if we're on the staff page and fetch initial data if needed
  const profileId = session?.effectiveProfileId || null;
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
    <MainLayoutClient
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
      <Suspense fallback={<AppShell.ContentSkeleton />}>{children}</Suspense>
    </MainLayoutClient>
  );
}
