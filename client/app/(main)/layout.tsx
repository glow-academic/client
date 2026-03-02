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
  exportPage,
  getGenerateMessages,
  getLayoutContextData,
  refreshPage,
  resolveGroupId,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

const SIDEBAR_COOKIE = "glow_sidebar";
const AUTOSAVE_COOKIE = "glow_autosave";
const AI_PANEL_COOKIE = "glow_ai_panel";

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

  const autosaveCookie = cookieStore.get(AUTOSAVE_COOKIE);
  const initialAutosave = autosaveCookie
    ? autosaveCookie.value === "true"
    : undefined;

  const aiPanelCookie = cookieStore.get(AI_PANEL_COOKIE);
  const initialPanelOpen = aiPanelCookie
    ? aiPanelCookie.value === "true"
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
  const { profileData, settingsData, pageData, snapshot, drafts, analyticsFilters } =
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

  // Resolve group_id: unified resolution from attempt, test, draft, or fresh
  const artifactType = pageData?.page_metadata?.artifact_type ?? null;
  const currentDraft = drafts.find((d) => d.artifact_type === artifactType);
  const draftGroupId = currentDraft?.group_id ?? null;
  const draftId = currentDraft?.id ? String(currentDraft.id) : null;

  // Parse attempt_id and test_id from pathname
  const attemptMatch = pathname.match(/\/attempt\/([0-9a-f-]{36})/);
  const attemptId = attemptMatch?.[1] ?? null;
  const testMatch = pathname.match(/\/test\/([0-9a-f-]{36})/);
  const testId = testMatch?.[1] ?? null;

  // Resolve group_id — handles attempt, test, draft, or creates fresh
  let groupId: string | null = null;
  let attemptControls: Awaited<ReturnType<typeof resolveGroupId>> | null = null;
  const needsGroup = attemptId || testId || (artifactType && pageData?.page_metadata?.show_drafts);
  if (needsGroup) {
    // Skip API call if draft already has a group_id and no attempt/test context
    if (draftGroupId && !attemptId && !testId) {
      groupId = draftGroupId;
    } else {
      const groupResult = await resolveGroupId({
        draft_id: draftId,
        artifact_type: artifactType,
        attempt_id: attemptId,
        test_id: testId,
      });
      groupId = groupResult.group_id;
      if (groupResult.show_controls) {
        attemptControls = groupResult;
      }
    }
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
        attemptControls={attemptControls}
        drafts={drafts}
        analyticsFilters={analyticsFilters}
        initialSidebarOpen={initialSidebarOpen}
        initialAutosave={initialAutosave}
        initialPanelOpen={initialPanelOpen}
        switchEffectiveProfileAction={switchEffectiveProfile}
        createFeedbackAction={createFeedback}
        refreshPageAction={refreshPage}
        exportPageAction={exportPage}
        searchSimulatableProfilesAction={searchSimulatableProfiles}
        getGenerateMessagesAction={getGenerateMessages}
        groupId={groupId}
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
