/**
 * app/create/videos/new/page.tsx
 * New video creation page with server actions
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import Video from "@/components/videos/Video";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type VideoDetailDefaultIn = InputOf<"/api/v3/videos/detail-default", "post">;
type VideoDetailDefaultOut = OutputOf<"/api/v3/videos/detail-default", "post">;
type CreateVideoIn = InputOf<"/api/v3/videos/create", "post">;
type CreateVideoOut = OutputOf<"/api/v3/videos/create", "post">;
type UpdateVideoIn = InputOf<"/api/v3/videos/update", "post">;
type UpdateVideoOut = OutputOf<"/api/v3/videos/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getVideoDefault = async (
  input: VideoDetailDefaultIn
): Promise<VideoDetailDefaultOut> => {
  return api.post("/videos/detail-default", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createVideo(input: CreateVideoIn): Promise<CreateVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/create", input);
}

async function updateVideo(input: UpdateVideoIn): Promise<UpdateVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/update", input);
}

export const metadata: Metadata = {
  title: "New Video",
  description: `New video creation in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewVideoPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default video detail server-side
  const videoDetailDefault = await getVideoDefault({
    body: { profileId },
  });

  return (
    <div
      className="space-y-6"
      data-page="video-new"
      aria-label="Create new video page"
    >
      <Video
        mode="create"
        videoDetailDefault={videoDetailDefault}
        createVideoAction={createVideo}
        updateVideoAction={updateVideo}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateVideoIn,
  CreateVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoDetailDefaultIn,
  VideoDetailDefaultOut,
};
