/**
 * app/(main)/analytics/activity/[sessionId]/page.tsx
 * Session detail page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222
 * 02/06/2026
 */

import { getSession } from "@/auth";
import Session from "@/components/artifacts/session/Session";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type SessionDetailIn = InputOf<"/session/get", "post">;
type SessionDetailOut = OutputOf<"/session/get", "post">;
type ContextIn = InputOf<"/session/context", "post">;
type ContextOut = OutputOf<"/session/context", "post">;
type GenerateSessionIn = InputOf<"/session/generate", "post">;
type GenerateSessionOut = OutputOf<"/session/generate", "post">;
type GenerationsIn = InputOf<"/session/generations", "post">;
type GenerationsOut = OutputOf<"/session/generations", "post">;
type GroupSessionIn = InputOf<"/session/group", "post">;
type GroupSessionOut = OutputOf<"/session/group", "post">;
type ProblemSessionIn = InputOf<"/session/problem", "post">;
type ProblemSessionOut = OutputOf<"/session/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSessionDetail = async (
  input: SessionDetailIn
): Promise<SessionDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/session/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function generateSession(
  input: GenerateSessionIn
): Promise<GenerateSessionOut> {
  "use server";
  return api.post("/session/generate", input);
}

async function getSessionGroupHistory(groupId: string): Promise<GroupSessionOut> {
  "use server";
  return api.post("/session/group", { body: { group_id: groupId } } as GroupSessionIn);
}

async function searchSessionGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/session/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createSessionProblem(input: ProblemSessionIn): Promise<ProblemSessionOut> {
  "use server";
  return api.post("/session/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  const context = await api.post("/session/context", { body: { entity_id: sessionId } } as ContextIn) as ContextOut;
  return { title: context.page_metadata?.detail.title, description: context.page_metadata?.detail.description };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession();

  if (!sessionId) {
    return null;
  }

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const pageContext = await api.post("/session/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, pageContext.profile);

  const [sessionDetail, context, groupResult] = await Promise.all([
    getSessionDetail({
      body: {
        session_id: sessionId,
      },
    }),
    api.post("/session/context", { body: { entity_id: sessionId } } as ContextIn) as Promise<ContextOut>,
    api.post("/session/group", { body: {} } as GroupSessionIn),
  ]);

  const _entityName = context.page_metadata?.detail.title;

  return (
    <FullPageLayout
      profileData={pageContext.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "activity",
        createFeedback: createSessionProblem,
      }}
      breadcrumbs={[
        { title: "Analytics", section: "analytics", url: "/analytics" },
        { title: "Activity", section: "activity", url: "/analytics/activity" },
        { title: "Session" },
      ]}
      panelProps={{
        artifactType: "session",
        groupId: (groupResult as GroupSessionOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateSession,
        permissions: [
          { artifact: "session", operation: "draft" },
          { artifact: "session", operation: "get" },
          { artifact: "session", operation: "docs" },
          { artifact: "session", operation: "group" },
        ],
        getGroupHistory: getSessionGroupHistory,
        searchGroups: searchSessionGroups,
      }}
    >
      <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <Session sessionDetail={sessionDetail} />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SessionDetailIn, SessionDetailOut };
