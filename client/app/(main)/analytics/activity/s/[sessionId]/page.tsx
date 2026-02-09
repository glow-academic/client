/**
 * app/(main)/analytics/activity/s/[sessionId]/page.tsx
 * Session detail page - shows interleaved audits and groups timeline.
 * @AshokSaravanan222
 * 02/06/2026
 */

import { getSession } from "@/auth";
import SessionTimeline from "@/components/activity/SessionTimeline";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SessionDetailIn = InputOf<"/api/v4/artifacts/session/get", "post">;
type SessionDetailOut = OutputOf<"/api/v4/artifacts/session/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSessionDetail = async (
  input: SessionDetailIn
): Promise<SessionDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/session/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(
  { params }: { params: Promise<{ sessionId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { sessionId } = await params;

  return {
    title: `Session ${sessionId.substring(0, 8)}...`,
    description:
      "Session detail view showing audit trail and pricing group activity for the teaching assistant platform.",
  };
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.user?.profileId;

  if (!profileId || !sessionId) {
    return null;
  }

  // Fetch session detail data with max audit limit for interleaving
  const sessionDetail = await getSessionDetail({
    body: {
      session_id: sessionId,
      audit_limit: 200,
      audit_offset: 0,
    },
  });

  return (
    <div className="space-y-6 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      <SessionTimeline sessionDetail={sessionDetail} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SessionDetailIn, SessionDetailOut };
