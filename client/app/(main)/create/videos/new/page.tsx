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
type GenerateOutlineIn = InputOf<"/api/v3/videos/generate-outline", "post">;
type GenerateOutlineOut = OutputOf<"/api/v3/videos/generate-outline", "post">;
type GenerateVideoIn = InputOf<"/api/v3/videos/generate-video", "post">;
type GenerateVideoOut = OutputOf<"/api/v3/videos/generate-video", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getVideoDefault = async (
  input: VideoNewIn
): Promise<VideoNewOut> => {
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
    title: "New Video",
    description: `New video creation in GLOW${orgPart}.`,
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
        generateOutlineAction={generateOutline}
        generateVideoAction={generateVideo}
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
