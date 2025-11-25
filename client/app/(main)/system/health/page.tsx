/**
 * app/(main)/system/health/page.tsx
 * System health page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import { getSession } from "@/auth";
import { Suspense } from "react";

import Logs from "@/components/logs/Logs";
import { LogsRunsClient } from "@/components/logs/LogsRunsClient";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LogsBundleIn = InputOf<"/api/v3/logs/bundle", "post">;
type LogsBundleOut = OutputOf<"/api/v3/logs/bundle", "post">;
type LogsRunsIn = InputOf<"/api/v3/logs/runs", "post">;
type LogsRunsOut = OutputOf<"/api/v3/logs/runs", "post">;
type BulkDeleteLogsIn = InputOf<"/api/v3/logs/bulk-delete", "post">;
type BulkDeleteLogsOut = OutputOf<"/api/v3/logs/bulk-delete", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getLogsBundle = cache(
  async (input: LogsBundleIn): Promise<LogsBundleOut> => {
    return api.post("/logs/bundle", input);
  }
);

/** ---- Direct fetch (no Next.js cache) ----
 * Logs runs responses can get large.
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getLogsRuns = async (input: LogsRunsIn): Promise<LogsRunsOut> => {
  const bypassCache = await isHardRefresh();
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  return api.post(
    "/logs/runs",
    {
      body: {
        ...input.body,
        profileId,
      },
    },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

async function bulkDeleteLogs(
  input: BulkDeleteLogsIn
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

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "System",
    description: `Manage system in GLOW${orgPart}.`,
  };
}

interface SystemPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SystemPage({ searchParams }: SystemPageProps) {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Fetch bundle data server-side (for KPIs, metrics, feedback)
  const bundleData = await getLogsBundle({
    body: { profileId },
  });

  // Extract pagination and filter params from search params for logs table
  const logsPage = searchParamsObj.get("logsPage")
    ? parseInt(searchParamsObj.get("logsPage") || "0", 10)
    : 0;
  const logsPageSize = searchParamsObj.get("logsPageSize")
    ? parseInt(searchParamsObj.get("logsPageSize") || "10", 10)
    : 10;
  const logsSearch = searchParamsObj.get("logsSearch") || undefined;
  const logsLevels = searchParamsObj.get("logsLevels")
    ? searchParamsObj.get("logsLevels")?.split(",").filter(Boolean)
    : undefined;
  const logsLoggerNames = searchParamsObj.get("logsLoggerNames")
    ? searchParamsObj.get("logsLoggerNames")?.split(",").filter(Boolean)
    : undefined;
  const logsActorNames = searchParamsObj.get("logsActorNames")
    ? searchParamsObj.get("logsActorNames")?.split(",").filter(Boolean)
    : undefined;
  const logsSortBy = searchParamsObj.get("logsSortBy") || "createdAt";
  const logsSortOrder = searchParamsObj.get("logsSortOrder") || "desc";

  // Create logsKey for Suspense boundary to trigger re-fetch on URL param changes
  const logsKey = [
    logsPage,
    logsPageSize,
    logsSearch || "",
    (logsLevels || []).join(","),
    (logsLoggerNames || []).join(","),
    (logsActorNames || []).join(","),
    logsSortBy,
    logsSortOrder,
  ].join("|");

  // Create empty runs data for loading state
  const emptyRunsData: LogsRunsOut = {
    data: [],
    totalCount: 0,
    page: logsPage,
    pageSize: logsPageSize,
    totalPages: 0,
    levelOptions: [],
    loggerOptions: [],
    actorOptions: [],
  };

  return (
    <div className="space-y-6">
      {/* This never gets unmounted when logsKey changes */}
      <Logs bundleData={bundleData} />

      {/* Only the runs section is tied to logsKey */}
      <Suspense
        key={logsKey}
        fallback={
          <LogsRunsClient
            runsData={emptyRunsData}
            isLoading={true}
            bulkDeleteLogsAction={bulkDeleteLogs}
          />
        }
      >
        <LogsRunsSection
          profileId={profileId}
          logsPage={logsPage}
          logsPageSize={logsPageSize}
          logsSearch={logsSearch}
          logsLevels={logsLevels}
          logsLoggerNames={logsLoggerNames}
          logsActorNames={logsActorNames}
          logsSortBy={logsSortBy}
          logsSortOrder={logsSortOrder}
        />
      </Suspense>
    </div>
  );
}

/** ---- Inline runs section component (only used here) ---- */
async function LogsRunsSection({
  profileId,
  logsPage,
  logsPageSize,
  logsSearch,
  logsLevels,
  logsLoggerNames,
  logsActorNames,
  logsSortBy,
  logsSortOrder,
}: {
  profileId: string;
  logsPage: number;
  logsPageSize: number;
  logsSearch?: string | undefined;
  logsLevels?: string[] | undefined;
  logsLoggerNames?: string[] | undefined;
  logsActorNames?: string[] | undefined;
  logsSortBy: string;
  logsSortOrder: string;
}) {
  // Build runs filters with pagination/search/sorting/filtering params
  const runsFilters = {
    profileId,
    page: logsPage,
    pageSize: logsPageSize,
    ...(logsSearch && { search: logsSearch }),
    sortBy: logsSortBy === "createdAt" ? null : logsSortBy,
    sortOrder: logsSortOrder === "desc" ? null : logsSortOrder,
    ...(logsLevels && logsLevels.length > 0 && { levels: logsLevels }),
    ...(logsLoggerNames &&
      logsLoggerNames.length > 0 && {
        loggerNames: logsLoggerNames,
      }),
    ...(logsActorNames &&
      logsActorNames.length > 0 && {
        actorNames: logsActorNames,
      }),
  };

  // Fetch runs data server-side
  const runsData = await getLogsRuns({
    body: runsFilters,
  });

  return (
    <LogsRunsClient
      runsData={runsData}
      isLoading={false}
      bulkDeleteLogsAction={bulkDeleteLogs}
    />
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
