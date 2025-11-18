/**
 * app/(main)/layout.tsx
 * Layout for the main section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { getSession } from "@/auth";
import { AppShell } from "@/components/common/layout/AppShell";
import { headers } from "next/headers";
import { Suspense } from "react";
import { MainLayoutClient } from "./layout-client";
import {
  bulkCreateOrUpdateStaff,
  createFeedback,
  getAssistantChatFull,
  getAssistantChatList,
  getCreateStaffData,
  getLayoutContextData,
  markChatComplete,
  markIntroComplete,
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
  const { initial, snapshot, attemptData } = await getLayoutContextData();

  // Check if we're on the staff page and fetch initial data if needed
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Read pathname from headers to check if we're on staff page
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";
  const isStaffPage = pathname === "/management/staff";

  let initialCreateStaffData = null;

  if (isStaffPage) {
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
      markIntroCompleteAction={markIntroComplete}
      markChatCompleteAction={markChatComplete}
      getAssistantChatListAction={getAssistantChatList}
      getAssistantChatFullAction={getAssistantChatFull}
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
