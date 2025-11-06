/**
 * app/(main)/system/logs/page.tsx
 * System logs page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { auth } from "@/auth";
import Logs from "@/components/logs/Logs";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LogsListIn = InputOf<"/api/v3/logs/list", "post">;
type LogsListOut = OutputOf<"/api/v3/logs/list", "post">;
type BulkDeleteLogsIn = InputOf<"/api/v3/logs/bulk-delete", "post">;
type BulkDeleteLogsOut = OutputOf<"/api/v3/logs/bulk-delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getLogsList = cache(async (input: LogsListIn): Promise<LogsListOut> => {
  return api.post("/logs/list", input);
});

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function bulkDeleteLogs(
  input: BulkDeleteLogsIn
): Promise<BulkDeleteLogsOut> {
  "use server";
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Override profileId from session (security)
  const out = await api.post("/logs/bulk-delete", {
    body: {
      ...input.body,
      profileId,
    },
  });
  revalidateTag("logs");
  return out;
}

export const metadata: Metadata = {
  title: "System",
  description: `Manage system in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function SystemPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getLogsList({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Logs listData={listData} bulkDeleteLogsAction={bulkDeleteLogs} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { BulkDeleteLogsIn, BulkDeleteLogsOut, LogsListOut };
