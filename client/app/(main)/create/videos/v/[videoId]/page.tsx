/**
 * app/(main)/create/videos/v/[videoId]/page.tsx
 * Edit video page with server actions
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/DepartmentAccessDenied";
import Video from "@/components/videos/Video";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

/** ---- Strong types from OpenAPI ---- */
type VideoDetailIn = InputOf<"/api/v3/videos/detail", "post">;
type VideoDetailOut = OutputOf<"/api/v3/videos/detail", "post">;
type CreateVideoIn = InputOf<"/api/v3/videos/create", "post">;
type CreateVideoOut = OutputOf<"/api/v3/videos/create", "post">;
type UpdateVideoIn = InputOf<"/api/v3/videos/update", "post">;
type UpdateVideoOut = OutputOf<"/api/v3/videos/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getVideo = async (input: VideoDetailIn): Promise<VideoDetailOut> => {
  return api.post("/videos/detail", input, {
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

/** ---- Server renders client with typed data and actions ---- */
export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch video detail (always fresh - source of truth)
  try {
    const videoDetail = await getVideo({
      body: { videoId, profileId },
    });

    return (
      <div className="space-y-6" data-page="video-edit" data-video-id={videoId}>
        <Video
          videoId={videoId}
          mode="edit"
          videoDetail={videoDetail}
          createVideoAction={createVideo}
          updateVideoAction={updateVideo}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <DepartmentAccessDenied
          resourceType="video"
          redirectPath="/create/videos"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateVideoIn,
  CreateVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoDetailIn,
  VideoDetailOut,
};
