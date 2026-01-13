/**
 * app/(main)/settings/page.tsx
 * Settings list page - shows list of settings
 */
import Settings from "@/components/settings/Settings";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SettingsListOut = OutputOf<"/api/v4/settings/list", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSettingsList = async (): Promise<SettingsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/settings/list",
    { body: {} },
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Settings",
    description:
      "Manage application settings including authentication methods, providers, departments, and configuration options.",
  };
}

export default async function SettingsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getSettingsList();

  return (
    <div className="space-y-6" data-page="settings-index">
      <Settings listData={listData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { SettingsListOut };
