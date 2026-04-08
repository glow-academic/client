/**
 * app/(main)/session/[sessionId]/page.tsx
 * Canonical session detail page — shows groups timeline.
 * @AshokSaravanan222
 * 02/06/2026
 */

import Session from "@/components/artifacts/session/Session";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SessionDetailIn = InputOf<"/session/get", "post">;
type SessionDetailOut = OutputOf<"/session/get", "post">;

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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/activity/docs", "post">;
type DocsOut = OutputOf<"/activity/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/activity/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  const docs = await getDocs({ body: { entity_id: sessionId } });
  return { title: docs.page_metadata?.detail.title, description: docs.page_metadata?.detail.description };
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  if (!sessionId) {
    return null;
  }

  const sessionDetail = await getSessionDetail({
    body: {
      session_id: sessionId,
    },
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Activity", section: "analytics", url: "/analytics/activity" },
          { title: "Session" },
        ]}
      />
      <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <Session sessionDetail={sessionDetail} />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SessionDetailIn, SessionDetailOut };
