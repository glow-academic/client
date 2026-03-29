/**
 * app/(main)/system/auth/page.tsx
 * Auth list page
 */
import Auths from "@/components/artifacts/auth/Auths";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/auths/search", "post">;
type DuplicateAuthIn = InputOf<"/auths/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/auths/duplicate", "post">;
type DeleteAuthIn = InputOf<"/auths/delete", "post">;
type DeleteAuthOut = OutputOf<"/auths/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getAuthList = async (): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/auths/search",
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateAuth(
  input: DuplicateAuthIn
): Promise<DuplicateAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auths/duplicate", input);
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auths/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/auths/docs", "post">;
type DocsOut = OutputOf<"/auths/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/auths/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

export default async function AuthPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getAuthList();

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "System", section: "system", url: "/system" },
          { title: "Auth" },
        ]}
        toolbar={<NewArtifactButton label="New Auth" href="/system/auth/new" />}
      />
      <div className="space-y-6 px-4" data-page="auth-index">
        <Auths
          listData={listData}
          duplicateAuthAction={duplicateAuth}
          deleteAuthAction={deleteAuth}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthListOut,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
};
