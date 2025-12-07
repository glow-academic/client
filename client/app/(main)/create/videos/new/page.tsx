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
type VideoNewIn = InputOf<"/api/v3/videos/new", "post">;
type VideoNewOut = OutputOf<"/api/v3/videos/new", "post">;
type CreateVideoIn = InputOf<"/api/v3/videos/create", "post">;
type CreateVideoOut = OutputOf<"/api/v3/videos/create", "post">;
type UpdateVideoIn = InputOf<"/api/v3/videos/update", "post">;
type UpdateVideoOut = OutputOf<"/api/v3/videos/update", "post">;
type RandomizeVideoIn = InputOf<"/api/v3/videos/randomize", "post">;
type RandomizeVideoOut = OutputOf<"/api/v3/videos/randomize", "post">;
// GenerateOutline/GenerateVideo types removed - now using WebSocket
type GenerateOutlineIn = never;
type GenerateOutlineOut = never;
type GenerateVideoIn = never;
type GenerateVideoOut = never;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getVideoDefault = async (input: VideoNewIn): Promise<VideoNewOut> => {
  return api.post("/videos/new", input, {
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

async function randomizeVideo(
  input: RandomizeVideoIn
): Promise<RandomizeVideoOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/videos/randomize", input);
}

// generateOutline and generateVideo removed - component now uses WebSocket directly

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Video",
    description:
      "Upload a new instructional video for teaching assistant training. Add multimedia resources to support pedagogical development, enhance learning experiences, and provide visual learning content for L&D programs.",
  };
}

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
        randomizeVideoAction={randomizeVideo}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateVideoIn,
  CreateVideoOut,
  GenerateOutlineIn,
  GenerateOutlineOut,
  GenerateVideoIn,
  GenerateVideoOut,
  RandomizeVideoIn,
  RandomizeVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoNewIn,
  VideoNewOut,
};
