/**
 * app/(main)/attempt/[attemptId]/page.tsx
 * Canonical attempt page — practice vs home is resolved from attempt data.
 * Full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { AttemptChat } from "@/components/artifacts/attempt/chat/setups/AttemptChat";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SimulationControls } from "@/components/common/SimulationControls";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadAttemptSearchParams } from "@/lib/search-params/attempt";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type AttemptDetailIn = InputOf<"/attempt/get", "post">;
type AttemptDetailOut = OutputOf<"/attempt/get", "post">;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GroupAttemptIn = InputOf<"/attempt/group", "post">;
type GroupAttemptOut = OutputOf<"/attempt/group", "post">;
type GenerationsIn = InputOf<"/attempt/generations", "post">;
type GenerationsOut = OutputOf<"/attempt/generations", "post">;
type ProblemAttemptIn = InputOf<"/attempt/problem", "post">;
type ProblemAttemptOut = OutputOf<"/attempt/problem", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for websocket/attempt pages.
 * Practice mode is determined server-side from the attempt data.
 */
const getAttemptDetail = async (
  attemptId: string,
): Promise<AttemptDetailOut> => {
  return api.post("/attempt/get", {
    body: { attempt_id: attemptId },
  }, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createAttemptProblem(input: ProblemAttemptIn): Promise<ProblemAttemptOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getAttemptGroup(input: GroupAttemptIn): Promise<GroupAttemptOut> {
  "use server";
  return api.post("/attempt/group", input);
}

async function searchAttemptGenerations(
  input: GenerationsIn,
): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAttemptContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/attempt/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Metadata uses context endpoint ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { attemptId } = await params;

  try {
    const context = await getAttemptContextById(attemptId);
    return {
      title: context.page_metadata?.detail.title ?? "Attempt",
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return {
      title: `Attempt ${attemptId.substring(0, 8)}...`,
      description:
        "Teaching practice session for graduate teaching assistant training. Review pedagogical performance, student interaction strategies, and teaching effectiveness through simulation-based learning assessment.",
    };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Page component ---- */
export default async function AttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { attemptId } = await params;
  const session = await getSession();
  const q = loadAttemptSearchParams(await searchParams);
  const draftId = q.draftId;
  const infiniteMode = q.infiniteMode ?? false;
  const userInstructions = q.userInstructions;

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers + attempt data in parallel
    const [attemptData, context, groupResult] = await Promise.all([
      getAttemptDetail(attemptId),
      getAttemptContextById(attemptId) as Promise<ContextOut>,
      api.post(
        "/attempt/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupAttemptIn,
      ),
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    if (attemptData.access_denied) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="simulation"
          redirectPath="/home"
        />
      );
    }

    const entityName = context.page_metadata?.detail.title;

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "practice",
          createFeedback: createAttemptProblem,
        }}
        breadcrumbs={[
          { title: entityName || "Attempt" },
        ]}
        toolbar={
          attemptData.should_show_controls && attemptData.current_chat_id ? (() => {
            const chat = attemptData.entries?.attempt_chat?.find(
              (c) => c.id === attemptData.current_chat_id,
            );
            return (
              <SimulationControls
                attemptId={attemptId}
                currentChatId={attemptData.current_chat_id}
                hasMessages={attemptData.has_messages ?? false}
                isStructuredMode={Boolean(
                  chat?.question_ids?.length || chat?.video_ids?.length,
                )}
                chatFlags={{
                  strengths_enabled: chat?.strengths_enabled,
                  improvements_enabled: chat?.improvements_enabled,
                  analyses_enabled: chat?.analyses_enabled,
                }}
              />
            );
          })() : undefined
        }
        panelProps={{
          artifactType: "attempt",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupAttemptOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupAttemptOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          prompts: context.prompts?.prompts,
          getGroupAction: getAttemptGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchAttemptGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        {/* Desktop-only gutter. On mobile the chat bubbles and input
            bar need the full horizontal room — the inner ScrollArea
            already provides 4px of breathing space on the edges. */}
        <div className="space-y-6 md:px-4">
          <AttemptChat
            attempt_id={attemptId}
            attempt_data={attemptData}
            draft_id={draftId}
            infinite_mode={infiniteMode}
            user_instructions={userInstructions}
          />
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
      // 401 → not logged in. Attempt pages have no single-resource
      // department concept, so 403 doesn't apply here — fall through and throw.
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={`/attempt/${attemptId}`}
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  AttemptDetailIn,
  AttemptDetailOut,
  AttemptDetailIn as AttemptFullIn,
  AttemptDetailOut as AttemptFullOut,
};
