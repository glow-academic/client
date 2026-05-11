/**
 * app/(main)/analytics/activity/[sessionId]/page.tsx
 * Session detail page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222
 * 02/06/2026
 */

import { getSession } from "@/auth";
import Session from "@/components/artifacts/session/Session";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { loadSessionSearchParams } from "@/lib/search-params/session";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type SessionDetailIn = InputOf<"/system/session/get", "post">;
type SessionDetailOut = OutputOf<"/system/session/get", "post">;
type ContextIn = InputOf<"/system/context", "post">;
type ContextOut = OutputOf<"/system/context", "post">;
type SystemGroupIn = InputOf<"/system/group", "post">;
type SystemGroupOut = OutputOf<"/system/group", "post">;
type SystemGenerationsIn = InputOf<"/system/generations", "post">;
type SystemGenerationsOut = OutputOf<"/system/generations", "post">;
type ProblemSessionIn = InputOf<"/system/problem", "post">;
type ProblemSessionOut = OutputOf<"/system/problem", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSessionDetail = async (
  input: SessionDetailIn
): Promise<SessionDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/system/session/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Strongly-typed server actions ---- */
async function getSystemGroup(input: SystemGroupIn): Promise<SystemGroupOut> {
  "use server";
  return api.post("/system/group", input);
}

async function searchSystemGenerations(input: SystemGenerationsIn): Promise<SystemGenerationsOut> {
  "use server";
  return api.post("/system/generations", input);
}


async function createSessionProblem(input: ProblemSessionIn): Promise<ProblemSessionOut> {
  "use server";
  return api.post("/system/problem", input);
}

async function refreshSystem(): Promise<unknown> {
  "use server";
  // NOTE: `/system/refresh` is a Phase-A endpoint not yet in the
  // generated OpenAPI types; cast through PathKey to match the same
  // pattern used by the other analytics list pages until the next
  // type-gen pass picks it up.
  return api.post(
    "/system/refresh" as Parameters<typeof api.post>[0],
    { body: {} },
  );
}

async function exportSession(
  targetSessionId: string,
): Promise<{ file_id: string; file_name?: string }> {
  "use server";
  return api.post(
    "/system/export" as Parameters<typeof api.post>[0],
    {
      body: {
        view: "session",
        session_id: targetSessionId,
      },
    } as unknown as Parameters<typeof api.post>[1],
  ) as Promise<{ file_id: string; file_name?: string }>;
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSystemContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/system/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  try {
    const { sessionId } = await params;
    const context = await getSystemContextById(sessionId);
    return { title: context.page_metadata?.detail.title, description: context.page_metadata?.detail.description };
  } catch {
    return { title: "Session" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { sessionId } = await params;
  const q = loadSessionSearchParams(await searchParams);
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

  try {
    // Profile data for providers
    const pageContext = await api.post("/system/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, pageContext.profile);

    const [sessionDetail, context, groupResult] = await Promise.all([
      getSessionDetail({
        body: {
          session_id: sessionId,
        },
      }),
      getSystemContextById(sessionId) as Promise<ContextOut>,
      api.post(
        "/system/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as SystemGroupIn,
      ),
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
        toolbar={
          <ArtifactToolbarActions
            refreshAction={refreshSystem}
            exportAction={exportSession.bind(null, sessionId)}
            bffDownloadPrefix="/api/system/download"
          />
        }
        panelProps={{
          artifactType: "session",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as SystemGroupOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as SystemGroupOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getSystemGroup as PanelProps["getGroupAction"],
          searchGenerationsAction: searchSystemGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
          <Session sessionDetail={sessionDetail} />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      // 401 → not logged in. Analytics pages have no single-resource concept,
      // so 403 (wrong department) doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={`/analytics/activity/${sessionId}`}
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SessionDetailIn, SessionDetailOut };
