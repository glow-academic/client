/**
 * app/(main)/create/videos/v/[videoId]/page.tsx
 * Edit video page with server actions
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */

import { getSession } from "@/auth";

import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
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
type RandomizeVideoIn = InputOf<"/api/v3/videos/randomize", "post">;
type RandomizeVideoOut = OutputOf<"/api/v3/videos/randomize", "post">;
type GenerateQuestionsIn = InputOf<"/api/v3/videos/generate-questions", "post">;
type GenerateQuestionsOut = OutputOf<"/api/v3/videos/generate-questions", "post">;
type GenerateOutlineIn = InputOf<"/api/v3/videos/generate-outline", "post">;
type GenerateOutlineOut = OutputOf<"/api/v3/videos/generate-outline", "post">;
type GenerateVideoIn = InputOf<"/api/v3/videos/generate-video", "post">;
type GenerateVideoOut = OutputOf<"/api/v3/videos/generate-video", "post">;

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

async function randomizeVideo(input: RandomizeVideoIn): Promise<RandomizeVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/randomize", input);
}

async function generateQuestions(
  input: GenerateQuestionsIn
): Promise<GenerateQuestionsOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/generate-questions", input);
}

async function generateOutline(
  input: GenerateOutlineIn
): Promise<GenerateOutlineOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/generate-outline", input);
}

async function generateVideo(
  input: GenerateVideoIn
): Promise<GenerateVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/generate-video", input);
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
          randomizeVideoAction={randomizeVideo}
          generateQuestionsAction={generateQuestions}
          generateOutlineAction={generateOutline}
          generateVideoAction={generateVideo}
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
  GenerateQuestionsIn,
  GenerateQuestionsOut,
  GenerateOutlineIn,
  GenerateOutlineOut,
  GenerateVideoIn,
  GenerateVideoOut,
  RandomizeVideoIn,
  RandomizeVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoDetailIn,
  VideoDetailOut,
};
