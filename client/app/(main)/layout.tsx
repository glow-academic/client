/**
 * app/(main)/layout.tsx
 * Layout for the main section — provides sidebar, providers, and theme.
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
  getLayoutContextData,
  resolveGroupId,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

const SIDEBAR_COOKIE = "glow_sidebar";
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
  const { profileData, settingsData, snapshot, drafts, analyticsFilters } =
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

  // Resolve group_id from drafts
  const currentDraft = drafts.find((d) => {
    // Match draft to current page by checking pathname for the artifact type
    const type = d.artifact_type;
    return type && pathname.includes(type);
  });
  const draftGroupId = currentDraft?.group_id ?? null;
  const draftId = currentDraft?.id ? String(currentDraft.id) : null;

  // Parse attempt_id and test_id from pathname
  const attemptMatch = pathname.match(/\/attempt\/([0-9a-f-]{36})/);
  const attemptId = attemptMatch?.[1] ?? null;
  const testMatch = pathname.match(/\/test\/([0-9a-f-]{36})/);
  const testId = testMatch?.[1] ?? null;

  // Resolve group_id — handles attempt, test, draft, or creates fresh
  let groupId: string | null = null;
  const needsGroup = attemptId || testId || draftId;
  if (needsGroup) {
    if (draftGroupId && !attemptId && !testId) {
      groupId = draftGroupId;
    } else {
      const groupResult = await resolveGroupId({
        draft_id: draftId,
        artifact_type: currentDraft?.artifact_type ?? null,
        attempt_id: attemptId,
        test_id: testId,
      });
      groupId = groupResult.group_id;
    }
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
        drafts={drafts}
        analyticsFilters={analyticsFilters}
        initialSidebarOpen={initialSidebarOpen}
        initialAutosave={initialAutosave}
        switchEffectiveProfileAction={switchEffectiveProfile}
        createFeedbackAction={createFeedback}
        searchSimulatableProfilesAction={searchSimulatableProfiles}
        groupId={groupId}
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
