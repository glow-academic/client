/**
 * app/(main)/layout.tsx
 * Layout for the main section — provides sidebar + global providers (profile, socket, theme).
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
  getGroupMessages,
  getLayoutContextData,
  searchGroups,
} from "./layout-server";
import { LogoutGuard } from "./logout-guard";

const SIDEBAR_COOKIE = "glow_sidebar";

/** Routes that render their own full layout via FullPageLayout */
const FULL_PAGE_ROUTES = ["/training/personas", "/training/scenarios", "/training/cohorts", "/training/simulations", "/management/documents", "/management/profiles"];

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

  // Fetch global layout data (single call — profile context includes theme)
  const { profileData, snapshot } = await getLayoutContextData(session);

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

  // Full-page routes render their own layout via FullPageLayout — skip sidebar/panel chrome
  const isFullPage = FULL_PAGE_ROUTES.some((r) => pathname.startsWith(r));

  if (isFullPage) {
    return (
      <div key={`layout-wrapper-${pathname}`} data-route-pathname={pathname}>
        <Suspense
          key={`suspense-${pathname}`}
          fallback={<AppShell.ContentSkeleton />}
        >
          {children}
        </Suspense>
      </div>
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
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        createFeedbackAction={createFeedback}
        searchGroupsAction={searchGroups}
        getGroupMessagesAction={getGroupMessages}
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
