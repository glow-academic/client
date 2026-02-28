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
  getGenerateMessages,
  getLayoutContextData,
  refreshPage,
  resolveGroupId,
  searchSimulatableProfiles,
  switchEffectiveProfile,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

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

  // Read autosave preference from cookie for SSR
  const cookieStore = await cookies();
  const autosaveCookie = cookieStore.get(AUTOSAVE_COOKIE);
  const initialAutosave = autosaveCookie
    ? autosaveCookie.value === "true"
    : undefined;

  // Read AI panel open state from cookie for SSR
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
  const { profileData, settingsData, pageData, snapshot, attemptControls, drafts, insights, analyticsFilters } =
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

  // Resolve group_id: find the current draft's group_id or create a fresh one
  const artifactType = pageData?.page_metadata?.artifact_type ?? null;
  const currentDraft = drafts.find((d) => d.artifact_type === artifactType);
  const draftGroupId = currentDraft?.group_id ?? null;
  const draftId = currentDraft?.id ? String(currentDraft.id) : null;

  // Only resolve group_id for artifact pages (not list pages)
  let groupId: string | null = null;
  if (artifactType && pageData?.page_metadata?.show_drafts) {
    groupId = draftGroupId ?? await resolveGroupId(draftId, artifactType);
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
        insights={insights}
        analyticsFilters={analyticsFilters}
        initialAutosave={initialAutosave}
        initialPanelOpen={initialPanelOpen}
        switchEffectiveProfileAction={switchEffectiveProfile}
        createFeedbackAction={createFeedback}
        refreshPageAction={refreshPage}
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
