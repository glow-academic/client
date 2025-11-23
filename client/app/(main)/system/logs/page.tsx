/**
 * app/(main)/system/logs/page.tsx
 * System logs page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";

import Logs from "@/components/logs/Logs";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LogsBundleIn = InputOf<"/api/v3/logs/bundle", "post">;
type LogsBundleOut = OutputOf<"/api/v3/logs/bundle", "post">;
type LogsRunsIn = InputOf<"/api/v3/logs/runs", "post">;
type LogsRunsOut = OutputOf<"/api/v3/logs/runs", "post">;
type BulkDeleteLogsIn = InputOf<"/api/v3/logs/bulk-delete", "post">;
type BulkDeleteLogsOut = OutputOf<"/api/v3/logs/bulk-delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getLogsBundle = cache(async (input: LogsBundleIn): Promise<LogsBundleOut> => {
  return api.post("/logs/bundle", input);
});

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function getLogsRuns(
  input: LogsRunsIn,
): Promise<LogsRunsOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Override profileId from session (security)
  const out = await api.post("/logs/runs", {
    body: {
      ...input.body,
      profileId,
    },
  });
  return out;
}

async function bulkDeleteLogs(
  input: BulkDeleteLogsIn,
): Promise<BulkDeleteLogsOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Override profileId from session (security)
  const out = await api.post("/logs/bulk-delete", {
    body: {
      ...input.body,
      profileId,
    },
  });
  // No revalidateTag needed - Redis cache handles invalidation
  return out;
}

export const metadata: Metadata = {
  title: "System",
  description: `Manage system in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function SystemPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch bundle data server-side
  const bundleData = await getLogsBundle({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Logs
        bundleData={bundleData}
        getLogsRunsAction={getLogsRuns}
        bulkDeleteLogsAction={bulkDeleteLogs}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  BulkDeleteLogsIn,
  BulkDeleteLogsOut,
  LogsBundleIn,
  LogsBundleOut,
  LogsRunsIn,
  LogsRunsOut,
};
