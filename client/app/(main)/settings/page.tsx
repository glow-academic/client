/**
 * app/(main)/settings/page.tsx
 * Settings list page - shows list of settings
 */
import Settings from "@/components/artifacts/setting/Settings";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type SettingsListOut = OutputOf<"/api/v4/artifacts/settings/list", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getSettingsList = async (): Promise<SettingsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/settings/list",
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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/settings/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/settings/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/settings/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
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
