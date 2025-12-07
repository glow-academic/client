/**
 * app/(main)/create/videos/page.tsx
 * Videos list page - displays all videos with filtering
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
import { getSession } from "@/auth";

import { Videos } from "@/components/videos/Videos";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type VideosListOut = OutputOf<"/api/v3/videos/list", "post">;
type DuplicateVideoIn = InputOf<"/api/v3/videos/duplicate", "post">;
type DuplicateVideoOut = OutputOf<"/api/v3/videos/duplicate", "post">;
type DeleteVideoIn = InputOf<"/api/v3/videos/delete", "post">;
type DeleteVideoOut = OutputOf<"/api/v3/videos/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getVideosList = async (profileId: string): Promise<VideosListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/videos/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateVideo(
  input: DuplicateVideoIn,
): Promise<DuplicateVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/duplicate", input);
}

async function deleteVideo(input: DeleteVideoIn): Promise<DeleteVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  return {
    title: "Videos",
    description: "Manage instructional videos and multimedia resources for teaching assistant training. Upload, organize, and share educational video content to support pedagogical development and enhance learning experiences.",
  };
}
}

export default async function VideosPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getVideosList(profileId);

  return (
    <div className="space-y-6" data-page="videos-index">
      <Videos
        listData={listData}
        duplicateVideoAction={duplicateVideo}
        deleteVideoAction={deleteVideo}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteVideoIn,
  DeleteVideoOut,
  DuplicateVideoIn,
  DuplicateVideoOut,
  VideosListOut,
};
