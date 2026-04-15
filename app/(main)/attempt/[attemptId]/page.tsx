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
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SimulationControls } from "@/components/common/SimulationControls";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { cookies } from "next/headers";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type AttemptDetailIn = InputOf<"/attempt/get", "post">;
type AttemptDetailOut = OutputOf<"/attempt/get", "post">;
type ContextIn = InputOf<"/attempt/context", "post">;
type ContextOut = OutputOf<"/attempt/context", "post">;
type GenerateAttemptIn = InputOf<"/attempt/generate", "post">;
type GenerateAttemptOut = OutputOf<"/attempt/generate", "post">;
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
async function generateAttempt(
  input: GenerateAttemptIn
): Promise<GenerateAttemptOut> {
  "use server";
  return api.post("/attempt/generate", input);
}

async function getAttemptGroupHistory(groupId: string): Promise<GroupAttemptOut> {
  "use server";
  return api.post("/attempt/group", { body: { group_id: groupId } } as GroupAttemptIn);
}

async function searchAttemptGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/attempt/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createAttemptProblem(input: ProblemAttemptIn): Promise<ProblemAttemptOut> {
  "use server";
  return api.post("/attempt/problem", input);
}

/** ---- Metadata uses context endpoint ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ attemptId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { attemptId } = await params;

  try {
    const context = await api.post("/attempt/context", { body: { entity_id: attemptId } } as ContextIn) as ContextOut;
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
  const sp = await searchParams;
  const rawDraftId = sp["draftId"];
  const draftId =
    typeof rawDraftId === "string"
      ? rawDraftId
      : Array.isArray(rawDraftId)
        ? (rawDraftId[0] ?? null)
        : null;
  const infiniteMode = sp["infiniteMode"] === "true";
  const rawInstructions = sp["userInstructions"];
  const userInstructions =
    typeof rawInstructions === "string" ? rawInstructions : null;

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

  try {
    const [attemptData, context, groupResult] = await Promise.all([
      getAttemptDetail(attemptId),
      api.post("/attempt/context", { body: { entity_id: attemptId } } as ContextIn) as Promise<ContextOut>,
      api.post("/attempt/group", { body: {} } as GroupAttemptIn),
    ]);

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
        profileData={profileData}
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
          attemptData.should_show_controls && attemptData.current_chat_id ? (
            <SimulationControls
              attemptId={attemptId}
              currentChatId={attemptData.current_chat_id}
              hasMessages={attemptData.has_messages ?? false}
            />
          ) : undefined
        }
        panelProps={{
          artifactType: "attempt",
          groupId: (groupResult as GroupAttemptOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateAttempt,
          permissions: [
            { artifact: "attempt", operation: "draft" },
            { artifact: "attempt", operation: "get" },
            { artifact: "attempt", operation: "docs" },
            { artifact: "attempt", operation: "group" },
          ],
          getGroupHistory: getAttemptGroupHistory,
          searchGroups: searchAttemptGroups,
        }}
      >
        <div className="space-y-6 px-4">
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
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="scenario"
          redirectPath="/home"
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
