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
// GenerateOutline/GenerateVideo types removed - now using WebSocket
type GenerateOutlineIn = never;
type GenerateVideoIn = never;
type GenerateOutlineOut = never;
type GenerateVideoOut = never;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getVideo = async (
  videoId: string,
  profileId: string,
  filterParams?: {
    departmentIds?: string[];
    personaIds?: string[];
    documentIds?: string[];
    templateDocumentIds?: string[];
    parameterIds?: string[];
    fieldIds?: string[];
    personaSearch?: string;
    documentSearch?: string;
    parameterSearch?: string;
    personaMin?: number;
    personaMax?: number;
    documentMin?: number;
    documentMax?: number;
    parameterSelectionMin?: number;
    parameterSelectionMax?: number;
    questionMin?: number;
    questionMax?: number;
    fieldRanges?: Record<string, { min: number; max: number }>;
    randomize?: string; // Single randomize param: "all", "persona", "document", "parameters", or "parameter_{paramId}"
    outlineIds?: string[];
    questionIds?: string[];
    videoIds?: string[];
  }
): Promise<VideoDetailOut> => {
  return api.post(
    "/videos/detail",
    {
      body: {
        videoId,
        profileId,
        ...(filterParams || {}),
      },
    },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
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

/** ---- Server renders client with typed data and actions ---- */
export default async function EditVideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ videoId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { videoId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Extract filter params
  const departmentIds = searchParamsObj
    .get("departmentIds")
    ?.split(",")
    .filter(Boolean);
  const personaIds = searchParamsObj
    .get("personaIds")
    ?.split(",")
    .filter(Boolean);
  const documentIds = searchParamsObj
    .get("documentIds")
    ?.split(",")
    .filter(Boolean);
  const templateDocumentIds = searchParamsObj
    .get("templateDocumentIds")
    ?.split(",")
    .filter(Boolean);
  const parameterIds = searchParamsObj
    .get("parameterIds")
    ?.split(",")
    .filter(Boolean);
  const fieldIds = searchParamsObj.get("fieldIds")?.split(",").filter(Boolean);
  // Parse single randomize param (matching scenarios pattern)
  const randomize = searchParamsObj.get("randomize") || undefined;
  // Extract URL parameters for linking generated resources (parsed but not passed to API - just for URL tracking)
  const _outlineIds = searchParamsObj
    .get("outlineIds")
    ?.split(",")
    .filter(Boolean);
  const _questionIds = searchParamsObj
    .get("questionIds")
    ?.split(",")
    .filter(Boolean);
  const _videoIds = searchParamsObj.get("videoIds")?.split(",").filter(Boolean);
  const personaSearch = searchParamsObj.get("personaSearch") || undefined;
  const documentSearch = searchParamsObj.get("documentSearch") || undefined;
  const parameterSearch = searchParamsObj.get("parameterSearch") || undefined;
  const personaMin = searchParamsObj.get("personaMin")
    ? parseInt(searchParamsObj.get("personaMin") || "1", 10)
    : undefined;
  const personaMax = searchParamsObj.get("personaMax")
    ? parseInt(searchParamsObj.get("personaMax") || "2", 10)
    : undefined;
  const documentMin = searchParamsObj.get("documentMin")
    ? parseInt(searchParamsObj.get("documentMin") || "0", 10)
    : undefined;
  const documentMax = searchParamsObj.get("documentMax")
    ? parseInt(searchParamsObj.get("documentMax") || "2", 10)
    : undefined;
  const parameterSelectionMin = searchParamsObj.get("parameterSelectionMin")
    ? parseInt(searchParamsObj.get("parameterSelectionMin") || "0", 10)
    : undefined;
  const parameterSelectionMax = searchParamsObj.get("parameterSelectionMax")
    ? parseInt(searchParamsObj.get("parameterSelectionMax") || "5", 10)
    : undefined;
  const questionMin = searchParamsObj.get("questionMin")
    ? parseInt(searchParamsObj.get("questionMin") || "0", 10)
    : undefined;
  const questionMax = searchParamsObj.get("questionMax")
    ? parseInt(searchParamsObj.get("questionMax") || "3", 10)
    : undefined;

  // Parse field ranges
  const fieldRanges: Record<string, { min: number; max: number }> | undefined =
    (() => {
      const ranges: Record<string, { min: number; max: number }> = {};
      let hasRanges = false;
      for (const [key, value] of searchParamsObj.entries()) {
        if (key.startsWith("fieldMin_")) {
          const paramId = key.replace("fieldMin_", "");
          const min = parseInt(value, 10);
          if (!isNaN(min)) {
            if (!ranges[paramId]) ranges[paramId] = { min: 1, max: 2 };
            ranges[paramId].min = min;
            hasRanges = true;
          }
        } else if (key.startsWith("fieldMax_")) {
          const paramId = key.replace("fieldMax_", "");
          const max = parseInt(value, 10);
          if (!isNaN(max)) {
            if (!ranges[paramId]) ranges[paramId] = { min: 1, max: 2 };
            ranges[paramId].max = max;
            hasRanges = true;
          }
        }
      }
      return hasRanges ? ranges : undefined;
    })();

  // Parse randomization params
  const randomizePersonas =
    searchParamsObj.get("randomizePersonas") || undefined;
  const randomizeDocuments =
    searchParamsObj.get("randomizeDocuments") || undefined;
  const randomizeParameters =
    searchParamsObj.get("randomizeParameters") || undefined;

  const randomizeParameterItems: Record<string, string> | undefined = (() => {
    const items: Record<string, string> = {};
    for (const [key, value] of searchParamsObj.entries()) {
      if (key.startsWith("randomizeParameterItems_")) {
        const paramId = key.replace("randomizeParameterItems_", "");
        items[paramId] = value;
      }
    }
    return Object.keys(items).length > 0 ? items : undefined;
  })();

  // Fetch video detail (always fresh - source of truth) with filter params
  try {
    const filterParams: Parameters<typeof getVideo>[2] = {};
    if (departmentIds && departmentIds.length > 0)
      filterParams.departmentIds = departmentIds;
    if (personaIds && personaIds.length > 0)
      filterParams.personaIds = personaIds;
    if (documentIds && documentIds.length > 0)
      filterParams.documentIds = documentIds;
    if (templateDocumentIds && templateDocumentIds.length > 0)
      filterParams.templateDocumentIds = templateDocumentIds;
    if (parameterIds && parameterIds.length > 0)
      filterParams.parameterIds = parameterIds;
    if (fieldIds && fieldIds.length > 0) filterParams.fieldIds = fieldIds;
    if (personaSearch) filterParams.personaSearch = personaSearch;
    if (documentSearch) filterParams.documentSearch = documentSearch;
    if (parameterSearch) filterParams.parameterSearch = parameterSearch;
    if (personaMin !== undefined) filterParams.personaMin = personaMin;
    if (personaMax !== undefined) filterParams.personaMax = personaMax;
    if (documentMin !== undefined) filterParams.documentMin = documentMin;
    if (documentMax !== undefined) filterParams.documentMax = documentMax;
    if (parameterSelectionMin !== undefined)
      filterParams.parameterSelectionMin = parameterSelectionMin;
    if (parameterSelectionMax !== undefined)
      filterParams.parameterSelectionMax = parameterSelectionMax;
    if (questionMin !== undefined) filterParams.questionMin = questionMin;
    if (questionMax !== undefined) filterParams.questionMax = questionMax;
    if (fieldRanges) filterParams.fieldRanges = fieldRanges;
    if (randomize) filterParams.randomize = randomize;
    // Note: outlineIds, questionIds, videoIds are for URL tracking only, not passed to API

    const videoDetail = await getVideo(
      videoId,
      profileId,
      Object.keys(filterParams).length > 0 ? filterParams : undefined
    );

    return (
      <div className="space-y-6" data-page="video-edit" data-video-id={videoId}>
        <Video
          videoId={videoId}
          mode="edit"
          videoDetail={videoDetail}
          createVideoAction={createVideo}
          updateVideoAction={updateVideo}
          randomizeVideoAction={randomizeVideo}
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
