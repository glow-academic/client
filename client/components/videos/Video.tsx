/**
 * Video.tsx
 * Video creation and editing component with interactive question timeline
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

// UI Components

import { Button } from "@/components/ui/button";

// Custom Components
import { DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { DocumentSection } from "@/components/common/forms/DocumentSection";
import { ParameterItemSection } from "@/components/common/forms/ParameterItemSection";
import { ParameterSection } from "@/components/common/forms/ParameterSection";
import { PersonaSection } from "@/components/common/forms/PersonaSection";
import { VideoBasicInfoSection } from "@/components/videos/VideoBasicInfoSection";
import { VideoContentSection } from "@/components/videos/VideoContentSection";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";

// Types and API functions
import type {
  CreateVideoIn,
  CreateVideoOut,
  GenerateOutlineIn,
  GenerateOutlineOut,
  GenerateVideoIn,
  GenerateVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoNewOut,
} from "@/app/(main)/create/videos/new/page";
import type { VideoDetailOut } from "@/app/(main)/create/videos/v/[videoId]/page";
import type { components } from "@/lib/api/schema";

// Strong types from API schema
type AgentMappingItem = components["schemas"]["AgentMappingItem"];
type AgentMapping = Record<string, AgentMappingItem>;

// Parameter types (compatible with ParameterSelector)
type ParameterMappingItem = {
  name: string;
  description: string;
  numerical: boolean;
  policy_parameter?: boolean;
  video_parameter?: boolean;
  scenario_parameter?: boolean;
  document_parameter: boolean; // Required for ParameterSelector compatibility
  persona_parameter: boolean; // Required for ParameterSelector compatibility
};

type FieldMappingItem = {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
};

type ParameterMapping = Record<string, ParameterMappingItem>;
type FieldMapping = Record<string, FieldMappingItem>;

// Local question type for editing (IDs optional for new questions)
// Types match the API response structure from VideoDetailOut
type Question = {
  question_id?: string;
  question_text: string;
  allow_multiple: boolean;
  times: number[];
  options: QuestionOption[];
};
type QuestionOption = {
  option_id?: string;
  option_text: string;
  type: "discrete" | "freeform";
  is_correct: boolean;
};

export interface VideoProps {
  mode?: "create" | "edit";
  videoId?: string;
  videoDetail?: VideoDetailOut;
  videoDetailDefault?: VideoNewOut;
  createVideoAction?: (input: CreateVideoIn) => Promise<CreateVideoOut>;
  updateVideoAction?: (input: UpdateVideoIn) => Promise<UpdateVideoOut>;
  randomizeVideoAction?: (
    input: RandomizeVideoIn
  ) => Promise<RandomizeVideoOut>;
  generateOutlineAction?: (
    input: GenerateOutlineIn
  ) => Promise<GenerateOutlineOut>;
  generateVideoAction?: (input: GenerateVideoIn) => Promise<GenerateVideoOut>;
}

type RandomizeVideoIn = {
  body: {
    videoId?: string;
    profileId: string;
    departmentIds?: string[];
    documentIds?: string[];
    targets: string[];
  };
};

type RandomizeVideoOut = {
  success: boolean;
  message: string;
  documentIds: string[];
};

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  optional?: boolean;
}

export default function Video({
  mode = "create",
  videoId,
  videoDetail: serverVideoDetail,
  videoDetailDefault: serverVideoDetailDefault,
  createVideoAction,
  updateVideoAction,
  randomizeVideoAction,
  generateOutlineAction: _generateOutlineAction,
  generateVideoAction: _generateVideoAction,
}: VideoProps) {
  const router = useRouter();
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!videoId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Use server-provided data directly (no fallback needed - server pages always provide data)
  const videoDetail = serverVideoDetail;
  const videoDetailDefault = serverVideoDetailDefault;

  // Use edit detail when editing, default detail when creating - strongly typed
  const videoData: VideoDetailOut | VideoNewOut | undefined = isEditMode
    ? videoDetail
    : videoDetailDefault;

  // Set breadcrumb context when video data is loaded
  useEffect(() => {
    if (videoDetail?.name && videoId && isEditMode) {
      setEntityMetadata({
        entityId: videoId,
        entityName: videoDetail.name,
        entityType: "video",
      });
    }
    return () => clearEntityMetadata();
  }, [
    videoDetail,
    videoId,
    isEditMode,
    setEntityMetadata,
    clearEntityMetadata,
  ]);

  // Extract body types for type safety - using strong types from API
  type CreateVideoBody = CreateVideoIn extends { body: infer B } ? B : never;
  type UpdateVideoBody = UpdateVideoIn extends { body: infer B } ? B : never;

  // Server action handlers
  const handleCreateVideo = async (body: CreateVideoBody) => {
    if (!createVideoAction) {
      throw new Error("createVideoAction is required");
    }
    return await createVideoAction({ body });
  };

  const handleUpdateVideo = async (body: UpdateVideoBody) => {
    if (!updateVideoAction) {
      throw new Error("updateVideoAction is required");
    }
    return await updateVideoAction({ body });
  };

  // Helper function to prepare video creation payload
  const prepareCreatePayload = (): CreateVideoBody => {
    const finalDepartmentIds = transformDepartmentIdsForSubmit(
      formData.departmentIds || [],
      isSuperadmin,
      videoData?.valid_department_ids || []
    );

    // Transform questions for API
    const questionsForApi = questions.map((q) => ({
      question_text: q.question_text,
      allow_multiple: q.allow_multiple,
      times: q.times,
      options: q.options.map((opt) => ({
        option_text: opt.option_text,
        type: opt.type,
        is_correct: opt.is_correct,
      })),
    }));

    // Prepare outline IDs
    const outlineIds: string[] = [];
    if (selectedOutlineId) {
      outlineIds.push(selectedOutlineId);
    }

    // Get video upload IDs and names from images array
    const uploadIds = images.map((img) => img.upload_id || img.id);
    const imageNames = images.map((img) => img.name);

    // Provide defaults for required fields
    const videoName = formData.name?.trim() || "New Video";

    const createPayload: CreateVideoBody = {
      name: videoName,
      length_seconds: 8, // Server determines actual length, but type requires this field
      department_ids: finalDepartmentIds,
      active: formData.active ?? true,
      questions: questionsForApi,
      persona_ids: formData.personaIds || [],
    };

    if (outlineIds.length > 0) {
      createPayload.outline_ids = outlineIds;
    }
    if (selectedDocumentIds.length > 0) {
      createPayload.document_ids = selectedDocumentIds;
    }
    if (uploadIds.length > 0) {
      createPayload.upload_ids = uploadIds;
      createPayload.image_names = imageNames;
    }
    if (currentParameterItemIds.length > 0) {
      createPayload.parameter_item_ids = currentParameterItemIds;
    }
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      createPayload.parameter_ids = formData.parameterIds;
    }
    // Note: outline_agent_id is not supported in create endpoint
    // It will be set via update after creation if needed

    return createPayload;
  };

  const handleRandomizeVideo = async (targets: string[], section: string) => {
    if (!randomizeVideoAction || !effectiveProfile?.id) {
      toast.error("Randomization not available");
      return;
    }

    setIsRandomizing(true);
    try {
      const body: RandomizeVideoIn["body"] = {
        profileId: effectiveProfile.id,
        targets,
      };

      if (isEditMode && videoId) {
        body.videoId = videoId;
      }

      if (formData.departmentIds && formData.departmentIds.length > 0) {
        body.departmentIds = formData.departmentIds;
      }

      // For documents randomization, don't send documentIds to force randomization (like documents in Scenario.tsx)
      // The backend will randomize if documentIds is not provided
      if (section === "documents") {
        // Don't set body.documentIds - let backend randomize
      }

      // For parameters randomization, we handle it client-side
      if (section === "parameters") {
        // Client-side randomization for general video parameters
      }

      const result = await randomizeVideoAction({ body });

      if (result.success) {
        // Update documents if randomized
        if (
          targets.includes("documents") &&
          result.documentIds &&
          result.documentIds.length > 0
        ) {
          setSelectedDocumentIds(result.documentIds);

          // Randomize document parameters for the new documents (client-side)
          // Filter available document parameter items for the new documents
          const newDocumentParameterItemIds: string[] = [];
          documentParameterIds.forEach((paramId) => {
            const paramItems = Object.entries(fieldMapping)
              .filter(([_itemId, item]) => item.parameter_id === paramId)
              .map(([itemId]) => itemId);
            const validItems = paramItems.filter((itemId) =>
              validDocumentParameterItemIds.includes(itemId)
            );
            if (validItems.length > 0) {
              // Randomly select one item per parameter
              const randomIndex = Math.floor(Math.random() * validItems.length);
              const randomItemId = validItems[randomIndex];
              if (randomItemId) {
                newDocumentParameterItemIds.push(randomItemId);
              }
            }
          });

          // Update parameters: remove old document parameters, add new ones, keep general video parameters
          const nonDocumentParamIds = currentParameterItemIds.filter(
            (itemId) => {
              const item = fieldMapping[itemId];
              if (!item) return true;
              const paramId = item.parameter_id;
              return !documentParameterIds.includes(paramId);
            }
          );
          setCurrentParameterItemIds([
            ...nonDocumentParamIds,
            ...newDocumentParameterItemIds,
          ]);
        }

        // Note: Parameters randomization would need backend support to fully work
        // For now, we can randomize client-side for general video parameters
        if (targets.includes("parameters")) {
          const newGeneralParamItemIds: string[] = [];
          generalVideoParameterIds.forEach((paramId) => {
            const paramItems = Object.entries(fieldMapping)
              .filter(([_itemId, item]) => item.parameter_id === paramId)
              .map(([itemId]) => itemId);
            const validItems = paramItems.filter((itemId) =>
              validGeneralVideoParameterItemIds.includes(itemId)
            );
            if (validItems.length > 0) {
              // Randomly select one item per parameter
              const randomIndex = Math.floor(Math.random() * validItems.length);
              const randomItemId = validItems[randomIndex];
              if (randomItemId) {
                newGeneralParamItemIds.push(randomItemId);
              }
            }
          });

          // Update parameters: keep policy parameters, replace general video parameters
          const policyParamIds = currentParameterItemIds.filter((itemId) => {
            const item = fieldMapping[itemId];
            if (!item) return false;
            const paramId = item.parameter_id;
            return documentParameterIds.includes(paramId);
          });
          setCurrentParameterItemIds([
            ...policyParamIds,
            ...newGeneralParamItemIds,
          ]);
        }

        toast.success("Randomization completed successfully!");
      }
    } catch (error) {
      toast.error(
        `Failed to randomize: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsRandomizing(false);
    }
  };

  const handleGenerate = async () => {
    if (!socket || !isConnected || !effectiveProfile?.id) {
      toast.error("WebSocket not connected");
      return;
    }

    if (selectedDocumentIds.length === 0) {
      toast.error("Please select a policy");
      return;
    }

    if (!videoId) {
      toast.error("Please create the video first by clicking 'Create Video'");
      return;
    }

    // Use primary department ID if no departments selected (all departments)
    // Otherwise use first selected department
    const departmentId =
      formData.departmentIds && formData.departmentIds.length > 0
        ? formData.departmentIds[0]!
        : effectiveProfile?.primaryDepartmentId || "";

    if (!departmentId) {
      toast.error("Please select at least one department");
      return;
    }

    setIsGenerating(true);

    // Track generated resources
    const generatedImageIds: string[] = [];
    const generatedQuestionIds: string[] = [];
    let generatedOutlineId: string | null = null;
    let generatedVideoUrl: string | null = null;

    try {
      // WebSocket payload type (not using GenerateOutlineIn since it's never)
      const body = {
        departmentId,
        documentIds: selectedDocumentIds,
        questionIds: null as string[] | null, // Questions are now generated by outline agent if questionsMax > 0
        parameterItemIds:
          currentParameterItemIds.length > 0
            ? currentParameterItemIds
            : undefined,
        profileId: effectiveProfile.id,
        videoId: isEditMode && videoId ? videoId : undefined,
        questionsMin: questionCount[0] > 0 ? questionCount[0] : undefined,
        questionsMax: questionCount[1] > 0 ? questionCount[1] : undefined,
        existingQuestions:
          questions.length > 0
            ? questions.map((q) => ({
                question_id: q.question_id || undefined,
                question_text: q.question_text,
                allow_multiple: q.allow_multiple,
                times: q.times,
                options: q.options.map((opt) => ({
                  option_text: opt.option_text,
                  type: opt.type,
                  is_correct: opt.is_correct,
                })),
              }))
            : undefined,
        personaIds:
          formData.personaIds && formData.personaIds.length > 0
            ? formData.personaIds
            : undefined,
      };

      const result = await new Promise<{
        success: boolean;
        message: string;
        name: string;
        outline: string;
        outline_id?: string;
        video_name?: string;
        questions?: Array<{
          question_text: string;
          allow_multiple: boolean;
          options: Array<{
            option_text: string;
            type: string;
            is_correct: boolean;
          }>;
        }>;
        question_timestamps?: Record<string, number[]>;
      }>((resolve, reject) => {
        const toastId = `video-generate-${Date.now()}`;
        const initialMessage = "Starting video generation...";
        toast.loading(initialMessage, { id: toastId });

        const handleProgress = (data: {
          type: string;
          message?: string;
          tool_name?: string;
          trace_id?: string;
        }) => {
          const progressMessage =
            data.message ||
            (data.type === "start"
              ? initialMessage
              : data.tool_name
                ? `Calling ${data.tool_name}...`
                : "Processing...");
          toast.loading(progressMessage, { id: toastId });
        };

        // Tool completion event handlers
        const handleQuestionsComplete = (data: {
          success: boolean;
          question_ids: string[];
          trace_id?: string;
          message?: string;
        }) => {
          if (data.success) {
            generatedQuestionIds.push(...data.question_ids);
          }
        };

        const handleOutlineComplete = (data: {
          success: boolean;
          outline_id: string;
          trace_id?: string;
          message?: string;
        }) => {
          if (data.success) {
            generatedOutlineId = data.outline_id;
          }
        };

        const handleImageComplete = (data: {
          success: boolean;
          image_id: string;
          trace_id?: string;
          message?: string;
        }) => {
          if (data.success) {
            generatedImageIds.push(data.image_id);
          }
        };

        const handleVideoComplete = (data: {
          success: boolean;
          generation_id?: string;
          trace_id?: string;
          message?: string;
        }) => {
          // Video generation completion is handled separately via video_generation_complete
        };

        const handleDocumentComplete = (data: {
          success: boolean;
          document_id: string;
          parent_document_id: string;
          trace_id?: string;
          message?: string;
        }) => {
          // Document completion tracking if needed
        };

        // Listen for video generation completion (from video_generate handler)
        const handleVideoGenerationComplete = (data: {
          success: boolean;
          message: string;
          videoUrl?: string;
          videoId?: string;
        }) => {
          if (data.success && data.videoUrl) {
            generatedVideoUrl = data.videoUrl;
          }
        };

        const handleComplete = (data: {
          success: boolean;
          message: string;
          name: string;
          outline: string;
          outline_id?: string;
          video_name?: string;
          questions?: Array<{
            question_text: string;
            allow_multiple: boolean;
            options: Array<{
              option_text: string;
              type: string;
              is_correct: boolean;
            }>;
          }>;
          question_timestamps?: Record<string, number[]>;
          trace_id?: string;
        }) => {
          // Clean up all listeners
          socket.off("video_outline_generation_progress", handleProgress);
          socket.off("video_outline_generation_complete", handleComplete);
          socket.off("video_outline_generation_error", handleError);
          socket.off("questions_tool_complete", handleQuestionsComplete);
          socket.off("outline_tool_complete", handleOutlineComplete);
          socket.off("image_tool_complete", handleImageComplete);
          socket.off("video_tool_complete", handleVideoComplete);
          socket.off("document_tool_complete", handleDocumentComplete);
          socket.off(
            "video_generation_complete",
            handleVideoGenerationComplete
          );

          if (data.success) {
            toast.success(data.message || "Video generation completed!", {
              id: toastId,
            });
            const result: {
              success: boolean;
              message: string;
              name: string;
              outline: string;
              outline_id?: string;
              video_name?: string;
              questions?: Array<{
                question_text: string;
                allow_multiple: boolean;
                options: Array<{
                  option_text: string;
                  type: string;
                  is_correct: boolean;
                }>;
              }>;
              question_timestamps?: Record<string, number[]>;
            } = {
              success: true,
              message: data.message,
              name: data.name,
              outline: data.outline,
            };
            if (data.outline_id) result.outline_id = data.outline_id;
            if (data.video_name) result.video_name = data.video_name;
            if (data.questions) result.questions = data.questions;
            if (data.question_timestamps)
              result.question_timestamps = data.question_timestamps;
            resolve(result);
          } else {
            toast.error(data.message || "Video generation failed", {
              id: toastId,
            });
            reject(new Error(data.message || "Video generation failed"));
          }
        };

        const handleError = (data: {
          success: boolean;
          message: string;
          trace_id?: string;
        }) => {
          // Clean up all listeners
          socket.off("video_outline_generation_progress", handleProgress);
          socket.off("video_outline_generation_complete", handleComplete);
          socket.off("video_outline_generation_error", handleError);
          socket.off("questions_tool_complete", handleQuestionsComplete);
          socket.off("outline_tool_complete", handleOutlineComplete);
          socket.off("image_tool_complete", handleImageComplete);
          socket.off("video_tool_complete", handleVideoComplete);
          socket.off("document_tool_complete", handleDocumentComplete);
          socket.off(
            "video_generation_complete",
            handleVideoGenerationComplete
          );

          toast.error(data.message || "Video generation failed", {
            id: toastId,
          });
          reject(new Error(data.message || "Video generation failed"));
        };

        // Register all listeners
        socket.on("video_outline_generation_progress", handleProgress);
        socket.on("video_outline_generation_complete", handleComplete);
        socket.on("video_outline_generation_error", handleError);
        socket.on("questions_tool_complete", handleQuestionsComplete);
        socket.on("outline_tool_complete", handleOutlineComplete);
        socket.on("image_tool_complete", handleImageComplete);
        socket.on("video_tool_complete", handleVideoComplete);
        socket.on("document_tool_complete", handleDocumentComplete);
        socket.on("video_generation_complete", handleVideoGenerationComplete);

        socket.emit("video_outline", {
          departmentId: body.departmentId,
          documentIds: body.documentIds,
          questionIds: body.questionIds,
          parameterItemIds: body.parameterItemIds,
          existingQuestions: body.existingQuestions,
          profileId: body.profileId,
          videoId: body.videoId,
          questionsMin: body.questionsMin,
          questionsMax: body.questionsMax,
          personaIds: body.personaIds,
        });
      });

      if (result.success) {
        setOutlineText(result.outline);
        // Set outline ID if provided (when videoId exists, outline is saved to DB)
        if (result.outline_id) {
          setSelectedOutlineId(result.outline_id);
        }
        // Update video name if provided by the agent
        if (result.video_name) {
          handleInputChange("name", result.video_name);
        }
        // Update questions from response (only if questionsMax > 0)
        if (
          questionCount[1] > 0 &&
          result.questions &&
          result.questions.length > 0
        ) {
          const convertedQuestions: Question[] = result.questions.map((q) => ({
            question_text: q.question_text,
            allow_multiple: q.allow_multiple,
            times: [], // Will be set from question_timestamps
            options: q.options.map((opt) => ({
              option_text: opt.option_text,
              type: opt.type as "discrete" | "freeform",
              is_correct: opt.is_correct,
            })),
          }));
          setQuestions(convertedQuestions);
        }
        // Update question timestamps directly from response (only if questionsMax > 0)
        if (
          questionCount[1] > 0 &&
          result.question_timestamps &&
          result.questions
        ) {
          setQuestions((prevQuestions) =>
            prevQuestions.map((q, index) => {
              // Find timestamps for this question index (1-based in response)
              const questionKey = String(index + 1);
              const timestamps =
                result.question_timestamps?.[questionKey] || [];
              return {
                ...q,
                times: timestamps,
              };
            })
          );
        }

        // Update generated video URL if available
        if (generatedVideoUrl) {
          setGeneratedVideoUrl(generatedVideoUrl);
          setUploadedVideoFile(null);
          setVideoObjectUrl(null);
        }
      }
    } catch (error) {
      toast.error(
        `Failed to generate: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Keep handleGenerateOutline for backward compatibility (can be removed later)
  const handleGenerateOutline = handleGenerate;

  const handleGenerateVideo = async () => {
    if (!socket || !isConnected) {
      toast.error("WebSocket not connected");
      return;
    }

    if (!outlineText.trim()) {
      toast.error("Please generate or enter an outline first");
      return;
    }

    if (!videoId) {
      toast.error("Please create the video first by clicking 'Create Video'");
      return;
    }

    setIsGenerating(true);

    try {
      // Use first image if available (backend expects single image reference)
      const imageId = images.length > 0 && images[0] ? images[0].id : null;

      // WebSocket payload type (not using GenerateVideoIn since it's never)
      const body = {
        videoId: videoId,
        prompt: outlineText,
        imageReferenceId: imageId ?? null,
      };

      const result = await new Promise<{
        success: boolean;
        message: string;
        videoUrl?: string;
        videoId?: string;
      }>((resolve, reject) => {
        const handleProgress = (data: {
          type: string;
          message?: string;
          status?: string;
          progress?: number;
          video_id?: string;
        }) => {
          if (data.type === "start") {
            toast.info(data.message || "Starting video generation...");
          } else if (data.type === "polling" && data.status) {
            // Show progress updates
            const progressMsg =
              data.progress !== undefined
                ? `${Math.round(data.progress * 100)}%`
                : data.status;
            toast.info(`Video generation: ${progressMsg}`, {
              id: "video-progress",
            });
          }
        };

        const handleComplete = (data: {
          success: boolean;
          message: string;
          videoUrl?: string;
          videoId?: string;
        }) => {
          socket.off("video_generation_progress", handleProgress);
          socket.off("video_generation_complete", handleComplete);
          socket.off("video_generation_error", handleError);
          toast.dismiss("video-progress");

          if (data.success) {
            const result: {
              success: boolean;
              message: string;
              videoUrl?: string;
              videoId?: string;
            } = {
              success: true,
              message: data.message,
            };
            if (data.videoUrl) result.videoUrl = data.videoUrl;
            if (data.videoId) result.videoId = data.videoId;
            resolve(result);
          } else {
            reject(new Error(data.message || "Video generation failed"));
          }
        };

        const handleError = (data: {
          success: boolean;
          message: string;
          video_id?: string;
        }) => {
          socket.off("video_generation_progress", handleProgress);
          socket.off("video_generation_complete", handleComplete);
          socket.off("video_generation_error", handleError);
          toast.dismiss("video-progress");

          reject(new Error(data.message || "Video generation failed"));
        };

        socket.on("video_generation_progress", handleProgress);
        socket.on("video_generation_complete", handleComplete);
        socket.on("video_generation_error", handleError);

        socket.emit("video_generate", {
          videoId: body.videoId,
          prompt: body.prompt,
          imageReferenceId: body.imageReferenceId,
        });
      });

      if (result.success) {
        if (result.videoUrl) {
          setGeneratedVideoUrl(result.videoUrl);
          // Clear uploaded video when generated video replaces it
          setUploadedVideoFile(null);
          setVideoObjectUrl(null);
          toast.success("Video generated successfully!");
        } else {
          toast.info(result.message || "Video generation completed");
        }
      }
    } catch (error) {
      toast.error(
        `Failed to generate video: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetSection = (section: string) => {
    if (section === "documents") {
      setSelectedDocumentIds([]);
    } else if (section === "parameters") {
      setCurrentParameterItemIds([]);
    } else if (section === "outline") {
      setSelectedOutlineId(null);
      setOutlineText("");
    } else if (section === "images") {
      setImages([]);
      setUseImage(false);
    }
  };

  // Randomize all: personas, documents, and all parameters
  const handleRandomizeAll = async () => {
    try {
      await handleRandomizeVideo(
        ["personas", "documents", "parameters"],
        "all"
      );
      toast.success("All selections randomized");
    } catch {
      toast.error("Failed to randomize all selections");
    }
  };

  // Reset all: clear all selections
  const handleResetAll = () => {
    try {
      setFormData((prev) => ({
        ...prev,
        departmentIds: [],
        personaIds: [],
        parameterIds: [],
      }));
      setSelectedDocumentIds([]);
      setCurrentParameterItemIds([]);
      setSelectedOutlineId(null);
      setOutlineText("");
      setImages([]);
      setUseImage(false);
      setQuestions([]);
      setQuestionCount([0, 0]);
      toast.success("All selections reset");
    } catch {
      toast.error("Failed to reset all selections");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Calculate max images allowed: video length / 4 + 1 (default to 8 seconds)
    const videoLength = videoData?.length_seconds || 8;
    const maxImages = Math.floor(videoLength / 4) + 1;
    const currentImageCount = images.length;
    const remainingSlots = maxImages - currentImageCount;

    if (remainingSlots <= 0) {
      toast.error(
        `Maximum ${maxImages} image${maxImages !== 1 ? "s" : ""} allowed for a ${videoLength}-second video`
      );
      e.target.value = "";
      return;
    }

    // Process files up to the remaining slots
    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.warning(
        `Only ${remainingSlots} image${remainingSlots !== 1 ? "s" : ""} can be uploaded. ${files.length - remainingSlots} file${files.length - remainingSlots !== 1 ? "s" : ""} ignored.`
      );
    }

    // Filter valid image files
    const validFiles = filesToUpload.filter((file) =>
      file.type.startsWith("image/")
    );
    if (validFiles.length === 0) {
      toast.error("Please select valid image files");
      e.target.value = "";
      return;
    }

    // Upload each file
    for (const file of validFiles) {
      setIsUploadingImage(true);
      const toastId = toast.loading(`Uploading image: ${file.name}`, {
        description: "0% complete",
        dismissible: true,
      });

      try {
        let tusUploadInstance: tus.Upload | null = null;
        // Create TUS upload
        tusUploadInstance = new tus.Upload(file, {
          endpoint: `/api/uploads/upload`,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          onError: (error) => {
            toast.error(`Upload failed: ${file.name}`, {
              description: error.message || "An error occurred during upload",
              id: toastId,
            });
            setIsUploadingImage(false);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            toast.loading(`Uploading image: ${file.name}`, {
              description: `${percentage}% complete`,
              id: toastId,
            });
          },
          onSuccess: async () => {
            // Extract TUS upload_id from upload URL
            const uploadUrl = tusUploadInstance?.url || "";
            const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
            if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
              toast.error("Failed to extract upload ID from upload URL", {
                id: toastId,
              });
              setIsUploadingImage(false);
              return;
            }
            const tusUploadId = tusUploadIdMatch[1];

            // Finalize upload to get database upload_id
            try {
              const finalizeResponse = await fetch(
                `/api/uploads/upload/${tusUploadId}/finalize`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({}),
                }
              );

              const finalizeResult = await finalizeResponse.json();

              if (!finalizeResult.success || !finalizeResult.uploadId) {
                throw new Error(
                  finalizeResult.message || "Failed to finalize upload"
                );
              }

              const databaseUploadId = finalizeResult.uploadId;

              // Store upload_id directly (no image creation needed)
              // Image will be linked to video when form is submitted
              setImages((prev) => [
                ...prev,
                {
                  id: databaseUploadId, // Use upload_id as id
                  name: file.name,
                  mime_type: file.type,
                  upload_id: databaseUploadId,
                  file_path: `/api/v3/uploads/download/${databaseUploadId}`, // Use upload download endpoint
                },
              ]);
              toast.success(`Image uploaded: ${file.name}`, { id: toastId });
            } catch (finalizeError) {
              toast.error(
                `Failed to finalize upload: ${
                  finalizeError instanceof Error
                    ? finalizeError.message
                    : "Unknown error"
                }`,
                { id: toastId }
              );
            } finally {
              setIsUploadingImage(false);
            }
          },
        });

        tusUploadInstance.start();
      } catch (error) {
        toast.error(
          `Failed to upload image: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          {
            id: toastId,
          }
        );
        setIsUploadingImage(false);
      }
    }

    // Reset input to allow selecting the same file again
    e.target.value = "";
  };

  const handleVideoUpload = async (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Please select a video file");
      return;
    }

    if (!videoId) {
      toast.error("Please create the video first by clicking 'Create Video'");
      return;
    }

    setIsUploadingVideo(true);

    const toastId = toast.loading(`Uploading video: ${file.name}`, {
      description: "0% complete",
      dismissible: true,
    });

    try {
      // Generate a unique fileId for tracking
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      let tusUploadInstance: tus.Upload | null = null;
      // Create TUS upload
      tusUploadInstance = new tus.Upload(file, {
        endpoint: `/api/uploads/upload`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          filetype: file.type,
          fileId: fileId,
        },
        onError: (error) => {
          toast.error(`Upload failed: ${file.name}`, {
            description: error.message || "An error occurred during upload",
            id: toastId,
          });
          setIsUploadingVideo(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          toast.loading(`Uploading video: ${file.name}`, {
            description: `${percentage}% complete`,
            id: toastId,
          });
        },
        onSuccess: async () => {
          // Extract TUS upload_id from upload URL
          const uploadUrl = tusUploadInstance?.url || "";
          const tusUploadIdMatch = uploadUrl.match(/\/upload\/([^\/]+)/);
          if (!tusUploadIdMatch || !tusUploadIdMatch[1]) {
            toast.error("Failed to extract upload ID from upload URL", {
              id: toastId,
            });
            setIsUploadingVideo(false);
            return;
          }
          const tusUploadId = tusUploadIdMatch[1];

          // Finalize upload to get database upload_id
          try {
            const finalizeResponse = await fetch(
              `/api/uploads/upload/${tusUploadId}/finalize`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              }
            );

            const finalizeResult = await finalizeResponse.json();

            if (!finalizeResult.success || !finalizeResult.uploadId) {
              throw new Error(
                finalizeResult.message || "Failed to finalize upload"
              );
            }

            const databaseUploadId = finalizeResult.uploadId;

            // Update video with upload_id
            if (!updateVideoAction) {
              throw new Error("updateVideoAction is required");
            }

            // Get current video data to preserve other fields
            const currentVideo = serverVideoDetail || videoDetailDefault;
            if (!currentVideo) {
              throw new Error("Video data not available");
            }
            const updateResult = await updateVideoAction({
              body: {
                videoId: videoId,
                name: currentVideo.name,
                length_seconds: currentVideo.length_seconds,
                upload_id: databaseUploadId,
                department_ids: currentVideo.department_ids || [],
                outline_ids: currentVideo.outline_ids || [],
                document_ids: currentVideo.document_ids || [],
                active: currentVideo.active,
                questions: currentVideo.questions || [],
                outline_agent_id: currentVideo.outline_agent_id || null,
                image_agent_id: currentVideo.image_agent_id || null,
                parameter_item_ids:
                  (currentVideo as any).parameter_item_ids || [],
              },
            });

            if (updateResult.success) {
              // Clear generated video URL if it exists (uploaded video replaces it)
              setGeneratedVideoUrl(null);
              // Clear uploaded video file state (will be loaded from server)
              setUploadedVideoFile(null);
              setVideoObjectUrl(null);

              toast.success(`Video uploaded: ${file.name}`, { id: toastId });

              // Navigate to edit page (will refresh data automatically)
              router.push(`/create/videos/v/${videoId}`);
            } else {
              throw new Error(updateResult.message || "Failed to update video");
            }
          } catch (finalizeError) {
            toast.error(
              `Failed to finalize upload: ${
                finalizeError instanceof Error
                  ? finalizeError.message
                  : "Unknown error"
              }`,
              { id: toastId }
            );
          } finally {
            setIsUploadingVideo(false);
          }
        },
      });

      tusUploadInstance.start();
    } catch (error) {
      toast.error(
        `Failed to upload video: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        {
          id: toastId,
        }
      );
      setIsUploadingVideo(false);
    }
  };

  // Form data state
  const defaultDepartmentIds = useMemo(
    () =>
      getDefaultDepartmentIds(
        isSuperadmin,
        effectiveProfile?.primaryDepartmentId || null
      ),
    [isSuperadmin, effectiveProfile?.primaryDepartmentId]
  );

  type FormData = {
    name: string;
    length_seconds: number;
    departmentIds: string[];
    active: boolean;
    outlineAgentId: string | null;
    imageAgentId: string | null;
    videoAgentId: string | null;
    personaIds: string[];
    parameterIds: string[];
  };

  // Outline state
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(
    null
  );
  const [outlineText, setOutlineText] = useState<string>("");
  const [useImage, setUseImage] = useState(false);
  // Question count state: [min, max] - initialized from server or URL params
  const [questionCount, setQuestionCount] = useState<[number, number]>([0, 0]);
  const [images, setImages] = useState<
    Array<{
      id: string;
      name: string;
      mime_type: string;
      upload_id?: string;
      file_path?: string;
    }>
  >([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Documents state
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  // Parameter state
  const [currentParameterItemIds, setCurrentParameterItemIds] = useState<
    string[]
  >([]);

  // Video generation state
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(
    null
  );
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // Randomization state
  const [isRandomizing, setIsRandomizing] = useState(false);

  const initialFormData: FormData = useMemo(
    () => ({
      name: "New Video",
      length_seconds: 0,
      departmentIds: defaultDepartmentIds,
      problemStatement: "",
      active: true,
      outlineAgentId: null,
      imageAgentId: null,
      videoAgentId: null,
      personaIds: [],
      parameterIds: [],
    }),
    [defaultDepartmentIds]
  );

  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formDataInitializedRef = useRef<boolean>(false);

  // Department mapping
  const departmentMapping = useMemo(
    () => videoData?.department_mapping || {},
    [videoData?.department_mapping]
  );
  // Agent mapping for agent picker - properly typed from API
  const agentMapping = useMemo<AgentMapping>(() => {
    const mapping = videoData?.agent_mapping || {};
    // Ensure proper typing - API returns Record<string, AgentMappingItem>
    return mapping as AgentMapping;
  }, [videoData?.agent_mapping]);

  // Document mapping
  const documentMapping = useMemo(() => {
    // Server returns dict[str, dict[str, str]] which matches DocumentMappingItem structure
    // Use double assertion to handle index signature compatibility
    return (videoData?.document_mapping || {}) as unknown as Record<
      string,
      DocumentMappingItem
    >;
  }, [videoData?.document_mapping]);

  // Persona mapping
  const personaMapping = useMemo(() => {
    return (videoData?.persona_mapping || {}) as Record<
      string,
      {
        name: string;
        description: string;
        color: string;
        icon: string;
        image_model?: boolean | null;
        parameter_ids?: string[] | null;
        field_ids?: string[] | null;
      }
    >;
  }, [videoData?.persona_mapping]);

  // Parameter mapping (filtered by video_parameter = true OR document_parameter = true)
  const parameterMapping = useMemo((): ParameterMapping => {
    const mapping = videoData?.parameter_mapping || {};
    // Filter to include video_parameter = true OR document_parameter = true and convert to ParameterMapping format
    const filtered = Object.fromEntries(
      Object.entries(mapping).filter(([, param]) => {
        return (
          param?.video_parameter === true || param?.document_parameter === true
        );
      })
    );
    // Convert to ParameterMapping format with all required fields
    return Object.fromEntries(
      Object.entries(filtered).map(([key, param]) => [
        key,
        {
          name: param?.name || "",
          description: param?.description || "",
          numerical: param?.numerical || false,
          document_parameter: param?.document_parameter || false,
          video_parameter: param?.video_parameter || false,
          scenario_parameter: param?.scenario_parameter || false,
          persona_parameter: param?.persona_parameter || false,
        },
      ])
    ) as ParameterMapping;
  }, [videoData?.parameter_mapping]);

  // Parameter item mapping
  const fieldMapping = useMemo((): FieldMapping => {
    const mapping = videoData?.field_mapping || {};
    // Convert to FieldMapping format with proper value type (must be string for ParameterSelector)
    return Object.fromEntries(
      Object.entries(mapping).map(([key, item]) => [
        key,
        {
          name: item?.name || "",
          description: item?.description || "",
          parameter_id: item?.parameter_id || "",
          parameter_name: item?.parameter_name || "",
        },
      ])
    ) as FieldMapping;
  }, [videoData?.field_mapping]);

  // Filter parameters by document_parameter for display next to documents
  const documentParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter === true
    );
  }, [parameterMapping]);

  const generalVideoParameterIds = useMemo(() => {
    return Object.keys(parameterMapping).filter(
      (paramId) => parameterMapping[paramId]?.document_parameter !== true
    );
  }, [parameterMapping]);

  // Filter parameter item IDs by parameter type
  const documentParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, fieldMapping, documentParameterIds]);

  const generalVideoParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalVideoParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, fieldMapping, generalVideoParameterIds]);

  // Filter valid parameter item IDs by parameter type
  const validParameterItemIds = useMemo(() => {
    // Get all parameter item IDs from mapping that belong to video parameters
    const allVideoParamItemIds = Object.keys(fieldMapping).filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return Object.keys(parameterMapping).includes(paramId);
    });
    return allVideoParamItemIds;
  }, [fieldMapping, parameterMapping]);

  const validDocumentParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, fieldMapping, documentParameterIds]);

  const validGeneralVideoParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalVideoParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, fieldMapping, generalVideoParameterIds]);

  // Build parameter mappings filtered by type
  const documentParameterMapping = useMemo(() => {
    return Object.fromEntries(
      Object.entries(parameterMapping).filter(([paramId]) =>
        documentParameterIds.includes(paramId)
      )
    );
  }, [parameterMapping, documentParameterIds]);

  const generalVideoParameterMapping = useMemo(() => {
    // Filter to only show parameters that are selected in formData.parameterIds
    const selectedParamIds = formData.parameterIds || [];

    // If no parameters selected, show no parameter sections
    if (selectedParamIds.length === 0) {
      return {};
    }

    // Only include selected parameters that are general video parameters (not document parameters)
    return Object.fromEntries(
      Object.entries(parameterMapping).filter(
        ([paramId]) =>
          generalVideoParameterIds.includes(paramId) &&
          selectedParamIds.includes(paramId)
      )
    );
  }, [parameterMapping, generalVideoParameterIds, formData.parameterIds]);

  // Outline mapping (for version history) - only exists in VideoDetailOut, not VideoNewOut
  const outlineMapping = useMemo<
    Record<string, { outline: string; created_at: string; updated_at: string }>
  >(() => {
    if (isEditMode && videoDetail) {
      const mapping = videoDetail.outline_mapping || {};
      // Ensure proper typing
      return mapping as Record<
        string,
        { outline: string; created_at: string; updated_at: string }
      >;
    }
    return {};
  }, [isEditMode, videoDetail]);

  // Image mapping - create from images array for VideoContentSection
  const imageMapping = useMemo(() => {
    const mapping: Record<
      string,
      {
        id: string;
        name: string;
        upload_id?: string;
        file_path?: string;
        created_at: string;
        updated_at: string;
      }
    > = {};
    images.forEach((img) => {
      mapping[img.id] = {
        id: img.id,
        name: img.name,
        ...(img.upload_id ? { upload_id: img.upload_id } : {}),
        ...(img.file_path ? { file_path: img.file_path } : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    return mapping;
  }, [images]);

  // Load video data from server response
  useEffect(() => {
    if (videoData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing video data (only once)
      const deptIds = videoData.department_ids || [];

      setFormData({
        name: videoData.name,
        length_seconds: videoData.length_seconds,
        departmentIds: deptIds,
        active: videoData.active ?? true,
        outlineAgentId: videoData.outline_agent_id || null,
        imageAgentId: videoData.image_agent_id || null,
        videoAgentId: videoData.video_agent_id || null,
        personaIds: videoData.persona_ids || [],
        parameterIds: videoData.video_parameter_ids || [],
      });

      // Load parameter items
      if (videoData.parameter_item_ids) {
        setCurrentParameterItemIds(videoData.parameter_item_ids);
      }

      // Initialize question count from server data or default to [0, 0]
      if (videoData?.question_count_range) {
        setQuestionCount([
          videoData.question_count_range.min || 0,
          videoData.question_count_range.max || 0,
        ]);
      }

      // Load outline - only exists in VideoDetailOut
      if (isEditMode && videoDetail) {
        if (videoDetail.outline_ids && videoDetail.outline_ids.length > 0) {
          const outlineId = videoDetail.outline_ids[0]!;
          setSelectedOutlineId(outlineId);
          if (outlineMapping[outlineId]) {
            setOutlineText(outlineMapping[outlineId]?.["outline"] || "");
          }
        } else if (
          videoDetail.outline_mapping &&
          Object.keys(videoDetail.outline_mapping).length > 0
        ) {
          // If no outline_ids but outline_mapping exists, load the first outline
          const firstOutlineId = Object.keys(videoDetail.outline_mapping)[0]!;
          const outlineData = videoDetail.outline_mapping[firstOutlineId];
          if (outlineData?.["outline"]) {
            setOutlineText(outlineData["outline"]);
            setSelectedOutlineId(firstOutlineId);
          }
        }
      }

      // Load documents
      if (videoData.document_ids) {
        setSelectedDocumentIds(videoData.document_ids);
      }

      // Load video images (all images from array)
      if (
        videoData.video_images &&
        Array.isArray(videoData.video_images) &&
        videoData.video_images.length > 0
      ) {
        const loadedImages = videoData.video_images
          .map(
            (img: {
              id?: string;
              upload_id?: string;
              name?: string;
              mime_type?: string;
            }) => {
              const uploadId = img.upload_id || img.id;
              if (!uploadId) return null;
              return {
                id: uploadId, // Use upload_id as id
                name: img.name || "",
                mime_type: img.mime_type || "image/png",
                upload_id: uploadId,
                file_path: `/api/v3/uploads/download/${uploadId}`, // Use upload download endpoint
              };
            }
          )
          .filter(
            (
              img
            ): img is {
              id: string;
              name: string;
              mime_type: string;
              upload_id: string;
              file_path: string;
            } => img !== null
          );
        if (loadedImages.length > 0) {
          setImages(loadedImages);
          setUseImage(true);
        } else {
          setImages([]);
          setUseImage(false);
        }
      } else {
        setImages([]);
        setUseImage(false);
      }

      // Load video URL if video file exists - construct from upload_id
      if (isEditMode && videoDetail?.upload_id) {
        setGeneratedVideoUrl(
          `/api/v3/uploads/download/${videoDetail.upload_id}`
        );
      }

      // Load questions from server data (already strongly typed from API)
      if (videoData.questions && Array.isArray(videoData.questions)) {
        const loadedQuestions: Question[] = videoData.questions.map((q) => ({
          question_id: q.question_id,
          question_text: q.question_text,
          allow_multiple: q.allow_multiple,
          times: q.times,
          options: q.options.map((opt) => ({
            option_id: opt.option_id,
            option_text: opt.option_text,
            type: opt.type as "discrete" | "freeform",
            is_correct: opt.is_correct,
          })),
        }));
        setQuestions(loadedQuestions);
      }

      formDataInitializedRef.current = true;
    }
  }, [videoData, isEditMode, outlineMapping, videoDetail, videoId]);

  // Auto-select first available outline and question agents if not already selected
  useEffect(() => {
    // Wait for agent data to be available
    if (
      !videoData?.valid_agent_ids ||
      !agentMapping ||
      Object.keys(agentMapping).length === 0
    ) {
      return;
    }

    // In edit mode, wait for form data to be initialized from server
    if (isEditMode && !formDataInitializedRef.current) {
      return;
    }

    // Find first available agents
    const outlineAgentIds = videoData.valid_agent_ids.filter((id) => {
      const agent = agentMapping[id];
      return agent?.["roles"]?.includes("outline");
    });

    const imageAgentIds = videoData.valid_agent_ids.filter((id) => {
      const agent = agentMapping[id];
      return agent?.["roles"]?.includes("image");
    });

    const videoAgentIds = videoData.valid_agent_ids.filter((id) => {
      const agent = agentMapping[id];
      return agent?.["roles"]?.includes("video");
    });

    // Only update if we have agents and they're not already set
    const updates: Partial<FormData> = {};

    if (outlineAgentIds.length > 0 && !formData.outlineAgentId) {
      updates.outlineAgentId = outlineAgentIds[0]!;
    }

    if (imageAgentIds.length > 0 && !formData.imageAgentId) {
      updates.imageAgentId = imageAgentIds[0]!;
    }

    if (videoAgentIds.length > 0 && !formData.videoAgentId) {
      updates.videoAgentId = videoAgentIds[0]!;
    }

    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  }, [
    videoData?.valid_agent_ids,
    agentMapping,
    isEditMode,
    formData.outlineAgentId,
    formData.imageAgentId,
    formData.videoAgentId,
  ]);

  const handleInputChange = <K extends keyof FormData>(
    field: K,
    value: FormData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData["name"].trim()) {
      newErrors["name"] = "Name is required";
    }
    // length_seconds is optional - defaults to 4 seconds if not provided

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const finalDepartmentIds = transformDepartmentIdsForSubmit(
        formData.departmentIds || [],
        isSuperadmin,
        videoData?.valid_department_ids || []
      );

      // Transform questions for API
      const questionsForApi = questions.map((q) => ({
        question_text: q.question_text,
        allow_multiple: q.allow_multiple,
        times: q.times,
        options: q.options.map((opt) => ({
          option_text: opt.option_text,
          type: opt.type,
          is_correct: opt.is_correct,
        })),
      }));

      // Prepare outline IDs (will be created/saved when outline text exists)
      // For now, outline is saved as text - outline ID management will be handled server-side
      const outlineIds: string[] = [];
      if (selectedOutlineId) {
        outlineIds.push(selectedOutlineId);
      }

      // Get video upload IDs and names from images array
      const uploadIds = images.map((img) => img.upload_id || img.id);
      const imageNames = images.map((img) => img.name);

      if (isEditMode && videoId) {
        // UPDATE mode
        const updatePayload: UpdateVideoBody = {
          videoId,
          name: formData.name,
          length_seconds: videoData?.length_seconds || 8, // Use video's length or default to 8
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
          persona_ids: formData.personaIds || [],
        };

        if (outlineIds.length > 0) {
          updatePayload.outline_ids = outlineIds;
        }
        if (selectedDocumentIds.length > 0) {
          updatePayload.document_ids = selectedDocumentIds;
        }
        if (uploadIds.length > 0) {
          updatePayload.upload_ids = uploadIds;
          updatePayload.image_names = imageNames;
        }
        if (formData.outlineAgentId) {
          updatePayload.outline_agent_id = formData.outlineAgentId;
        }
        if (formData.imageAgentId) {
          updatePayload.image_agent_id = formData.imageAgentId;
        }
        // Note: video_agent_id is not in UpdateVideoRequest - it's set during video generation
        if (currentParameterItemIds.length > 0) {
          updatePayload.parameter_item_ids = currentParameterItemIds;
        }
        if (formData.parameterIds && formData.parameterIds.length > 0) {
          updatePayload.parameter_ids = formData.parameterIds;
        }

        await handleUpdateVideo(updatePayload);
        toast.success("Video updated successfully!");
      } else {
        // CREATE mode - use helper function
        const createPayload = prepareCreatePayload();

        await handleCreateVideo(createPayload);
        toast.success("Video created successfully!");

        // Redirect to list page
        router.push(`/create/videos`);
        return;
      }

      router.push(`/create/videos`);
    } catch (error) {
      toast.error(
        `Failed to ${isEditMode ? "update" : "create"} video: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReadonly = !videoData?.can_edit;

  // Calculate step status
  const getStepStatus = (stepId: string): StepStatus => {
    switch (stepId) {
      case "name":
        // Always completed - name is required
        return "completed";
      case "persona":
        // Can start immediately, doesn't depend on name
        return (formData.personaIds?.length || 0) > 0 ? "completed" : "active";
      case "documents":
        // Active when personas are selected, completed when documents are selected
        return (formData.personaIds?.length || 0) === 0
          ? "pending"
          : selectedDocumentIds.length > 0
            ? "completed"
            : "active";
      case "parameters":
        // Active when documents are selected, completed when parameter items are selected
        return selectedDocumentIds.length === 0
          ? "pending"
          : currentParameterItemIds.length > 0
            ? "completed"
            : "active";
      case "outline":
        // Active if documents are selected (questions are generated with outline)
        return selectedDocumentIds.length === 0
          ? "pending"
          : selectedOutlineId || outlineText.trim()
            ? "completed"
            : "active";
      case "video_generation":
        // Active if outline exists
        return !selectedOutlineId && !outlineText.trim()
          ? "pending"
          : uploadedVideoFile ||
              generatedVideoUrl ||
              (isEditMode && videoDetail?.upload_id)
            ? "completed"
            : "active";
      default:
        return "pending";
    }
  };

  const steps: Step[] = [
    {
      id: "name",
      title: "",
      description: "",
      status: getStepStatus("name"),
    },
    {
      id: "persona",
      title: "Personas",
      description: "Select personas for this video",
      status: getStepStatus("persona"),
    },
    {
      id: "documents",
      title: "Documents",
      description: "Select documents that will be available for this video",
      status: getStepStatus("documents"),
    },
    {
      id: "parameters",
      title: "Parameters",
      description: "Configure video parameters",
      status: getStepStatus("parameters"),
    },
    {
      id: "outline",
      title: "Outline",
      description:
        "Generate video outline from documents (questions are generated automatically)",
      status: getStepStatus("outline"),
    },
    {
      id: "video_generation",
      title: "Video Generation",
      description: "Generate video using AI or upload a video file",
      status: getStepStatus("video_generation"),
    },
  ];

  // New inline question management handlers
  const handleAddQuestion = () => {
    // Use questionCount[1] (max) as the limit, or calculate from video length
    const videoLength = videoData?.length_seconds || 8;
    const maxQuestions =
      questionCount[1] > 0 ? questionCount[1] : Math.floor(videoLength / 4) + 1;
    if (questions.length >= maxQuestions) {
      toast.error(
        `Maximum ${maxQuestions} question${maxQuestions !== 1 ? "s" : ""} allowed`
      );
      return;
    }
    setQuestions((prev) => [
      ...prev,
      {
        question_text: "",
        allow_multiple: false,
        times: [],
        options: [
          {
            option_text: "",
            type: "discrete" as const,
            is_correct: false,
          },
          {
            option_text: "",
            type: "discrete" as const,
            is_correct: false,
          },
        ],
      },
    ]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateQuestion = (index: number, question: Question) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? question : q)));
  };

  const handleQuestionTimesChange = (index: number, times: number[]) => {
    const currentQuestion = questions[index];
    if (!currentQuestion) return;
    handleUpdateQuestion(index, { ...currentQuestion, times });
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    option: QuestionOption
  ) => {
    const currentQuestion = questions[questionIndex];
    if (!currentQuestion) return;
    const newOptions = currentQuestion.options.map((opt, i) =>
      i === optionIndex ? option : opt
    );
    // Infer allow_multiple from number of correct answers
    const correctCount = newOptions.filter((opt) => opt.is_correct).length;
    handleUpdateQuestion(questionIndex, {
      ...currentQuestion,
      options: newOptions,
      allow_multiple: correctCount > 1,
    });
  };

  const handleAddOption = (questionIndex: number) => {
    const currentQuestion = questions[questionIndex];
    if (!currentQuestion || currentQuestion.options.length >= 5) return;
    handleUpdateQuestion(questionIndex, {
      ...currentQuestion,
      options: [
        ...currentQuestion.options,
        {
          option_text: "",
          type: "discrete" as const,
          is_correct: false,
        },
      ],
    });
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    const currentQuestion = questions[questionIndex];
    if (!currentQuestion || currentQuestion.options.length <= 2) return;
    const newOptions = currentQuestion.options.filter(
      (_, i) => i !== optionIndex
    );
    // Infer allow_multiple from number of correct answers
    const correctCount = newOptions.filter((opt) => opt.is_correct).length;
    handleUpdateQuestion(questionIndex, {
      ...currentQuestion,
      options: newOptions,
      allow_multiple: correctCount > 1,
    });
  };

  const handleToggleOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    const currentQuestion = questions[questionIndex];
    if (!currentQuestion) return;
    const newOptions = currentQuestion.options.map((opt, i) =>
      i === optionIndex ? { ...opt, is_correct: !opt.is_correct } : opt
    );
    // Infer allow_multiple from number of correct answers
    const correctCount = newOptions.filter((opt) => opt.is_correct).length;
    handleUpdateQuestion(questionIndex, {
      ...currentQuestion,
      options: newOptions,
      allow_multiple: correctCount > 1,
    });
  };

  // Drag and drop handlers for questions
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<
    number | null
  >(null);

  const handleDragStartQuestion = (e: React.DragEvent, index: number) => {
    setDraggedQuestionIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverQuestion = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropQuestion = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedQuestionIndex === null) return;

    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(draggedQuestionIndex, 1);
    if (movedQuestion) {
      newQuestions.splice(targetIndex, 0, movedQuestion);
      setQuestions(newQuestions);
    }
    setDraggedQuestionIndex(null);
  };

  // Drag and drop handlers for options
  const [draggedOptionIndex, setDraggedOptionIndex] = useState<{
    questionIndex: number;
    optionIndex: number;
  } | null>(null);

  const handleDragStartOption = (
    e: React.DragEvent,
    questionIndex: number,
    optionIndex: number
  ) => {
    setDraggedOptionIndex({ questionIndex, optionIndex });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverOption = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOption = (
    e: React.DragEvent,
    questionIndex: number,
    targetOptionIndex: number
  ) => {
    e.preventDefault();
    if (!draggedOptionIndex) return;

    const currentQuestion = questions[questionIndex];
    if (!currentQuestion) return;

    const newOptions = [...currentQuestion.options];
    const [movedOption] = newOptions.splice(draggedOptionIndex.optionIndex, 1);
    if (movedOption) {
      newOptions.splice(targetOptionIndex, 0, movedOption);
      handleUpdateQuestion(questionIndex, {
        ...currentQuestion,
        options: newOptions,
      });
    }
    setDraggedOptionIndex(null);
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get all question times for timeline markers (kept for compatibility, but timeline removed)
  const allQuestionTimes = useMemo(() => {
    const times = new Set<number>();
    questions.forEach((q) => {
      q.times.forEach((t) => times.add(t));
    });
    return Array.from(times).sort((a, b) => a - b);
  }, [questions]);

  // Handler for image selection (converting ImageMappingItem to expected format)
  const handleImageSelect = (imageId: string | null) => {
    if (imageId && imageMapping[imageId]) {
      // Note: VideoContentSection expects images array, not single image
      // This handler might not be used if we're using the array directly
      // Image selection is handled via the images array state
    }
  };

  // Handler for outline version selection
  const handleOutlineVersionSelect = (id: string) => {
    if (id && outlineMapping[id]) {
      setOutlineText(outlineMapping[id].outline);
      setSelectedOutlineId(id);
    }
  };

  // Handler for resetting outline
  const handleResetOutline = () => {
    if (
      isEditMode &&
      videoDetail &&
      videoDetail.outline_ids &&
      videoDetail.outline_ids.length > 0
    ) {
      const outlineId = videoDetail.outline_ids[0]!;
      if (outlineMapping[outlineId]) {
        setOutlineText(outlineMapping[outlineId].outline);
        setSelectedOutlineId(outlineId);
      }
    } else {
      setOutlineText("");
      setSelectedOutlineId(null);
    }
  };

  // Compute outline changes
  const hasOutlineChanges = useMemo(() => {
    if (!isEditMode || !videoDetail) return false;
    if (!selectedOutlineId) {
      // New outline text
      return outlineText.trim() !== "";
    }
    // Check if current text differs from selected outline version
    const selectedOutline = outlineMapping[selectedOutlineId];
    if (!selectedOutline) return false;
    return outlineText.trim() !== selectedOutline.outline.trim();
  }, [outlineText, selectedOutlineId, outlineMapping, isEditMode, videoDetail]);

  // Current outline IDs for version picker
  const currentOutlineIds = useMemo(() => {
    if (selectedOutlineId) {
      return [selectedOutlineId];
    }
    return [];
  }, [selectedOutlineId]);

  // Handler for resetting content
  const handleResetContent = () => {
    setSelectedOutlineId(null);
    setOutlineText("");
    setQuestions([]);
    setImages([]);
    setUseImage(false);
    setQuestionCount([0, 0]);
    setGeneratedVideoUrl(null);
    setUploadedVideoFile(null);
    setVideoObjectUrl(null);
  };

  // Handler for video preview document change
  const handleVideoPreviewDocumentChange = (docId: string | null) => {
    // This can be used to track which document is being previewed
    // For now, we'll just store it in state if needed
  };

  // Video preview document ID state
  const [videoPreviewDocumentId, setVideoPreviewDocumentId] = useState<
    string | null
  >(null);

  // Video upload state (placeholder for now)
  const [isDragActive, setIsDragActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
  const hasSetLengthRef = useRef<boolean>(false);

  // Create object URL when file changes
  useEffect(() => {
    if (uploadedVideoFile) {
      const url = URL.createObjectURL(uploadedVideoFile);
      setVideoObjectUrl(url);
      hasSetLengthRef.current = false;
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVideoObjectUrl(null);
      hasSetLengthRef.current = false;
      return undefined;
    }
  }, [uploadedVideoFile]);

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current && !hasSetLengthRef.current) {
      const duration = Math.floor(videoRef.current.duration);
      if (duration > 0 && !isNaN(duration)) {
        hasSetLengthRef.current = true;
        handleInputChange("length_seconds", duration);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      handleVideoUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = () => {
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("video/")) {
      handleVideoUpload(file);
    }
  };

  const handleRemoveVideo = () => {
    setUploadedVideoFile(null);
    handleInputChange("length_seconds", 0);
  };

  // Compute expected agent roles
  const expectedOutlineRole = "outline";
  const expectedVideoRole = "video";

  const validGeneralParameterItemIds = useMemo(() => {
    if (!fieldMapping) return [];
    return Object.keys(fieldMapping).filter((itemId) => {
      const field = fieldMapping[itemId];
      return field && formData.parameterIds?.includes(field.parameter_id);
    });
  }, [fieldMapping, formData.parameterIds]);

  return (
    <div className="space-y-6 py-4 px-4">
      {/* Step 1: Basic Information */}
      <VideoBasicInfoSection
        name={formData.name || ""}
        departmentIds={formData.departmentIds || []}
        validDepartmentIds={videoData?.valid_department_ids || []}
        departmentMapping={departmentMapping}
        outlineAgentId={formData.outlineAgentId}
        imageAgentId={formData.imageAgentId}
        videoAgentId={formData.videoAgentId}
        validAgentIds={videoData?.valid_agent_ids || []}
        agentMapping={agentMapping}
        expectedOutlineRole={expectedOutlineRole}
        expectedVideoRole={expectedVideoRole}
        active={formData.active ?? true}
        onNameChange={(name) => handleInputChange("name", name)}
        onDepartmentIdsChange={(ids) => handleInputChange("departmentIds", ids)}
        onOutlineAgentIdChange={(id) =>
          setFormData((prev) => ({ ...prev, outlineAgentId: id }))
        }
        onImageAgentIdChange={(id) =>
          setFormData((prev) => ({ ...prev, imageAgentId: id }))
        }
        onVideoAgentIdChange={(id) =>
          setFormData((prev) => ({ ...prev, videoAgentId: id }))
        }
        onActiveChange={(active) => handleInputChange("active", active)}
        onRandomizeAll={handleRandomizeAll}
        onResetAll={handleResetAll}
        isReadonly={isReadonly}
        isSuperadmin={isSuperadmin}
      />

      {/* Step 2: Persona Selection */}
      {videoData?.valid_persona_ids &&
        videoData.valid_persona_ids.length > 0 && (
          <PersonaSection
            validPersonaIds={videoData.valid_persona_ids}
            personaMapping={personaMapping}
            selectedPersonaIds={formData.personaIds || []}
            searchTerm=""
            minMax={{ min: 1, max: 2 }}
            onPersonaIdsChange={(ids) => handleInputChange("personaIds", ids)}
            onSearchTermChange={() => {}}
            onMinMaxChange={() => {}}
            onRandomize={() => {}}
            onReset={() => handleInputChange("personaIds", [])}
            stepStatus={getStepStatus("persona")}
            stepTitle={steps[1]?.title || ""}
            stepDescription={steps[1]?.description || ""}
            stepNumber={2}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
          />
        )}

      {/* Step 3: Documents */}
      <DocumentSection
        validDocumentIds={videoData?.valid_document_ids || []}
        documentMapping={documentMapping}
        selectedDocumentIds={selectedDocumentIds}
        templateDocumentIds={[]}
        {...(videoData?.document_details
          ? {
              documentDetails: videoData.document_details as Array<{
                document_id: string;
                upload_id?: string | null;
                [key: string]: unknown;
              }>,
            }
          : {})}
        searchTerm=""
        minMax={{ min: 1, max: 2 }}
        previewDocumentId={null}
        onDocumentIdsChange={setSelectedDocumentIds}
        onTemplateDocumentIdsChange={() => {}}
        onSearchTermChange={() => {}}
        onMinMaxChange={() => {}}
        onPreviewDocument={() => {}}
        onRandomize={() => handleRandomizeVideo(["documents"], "documents")}
        onReset={() => handleResetSection("documents")}
        stepStatus={getStepStatus("documents")}
        stepTitle={steps[2]?.title || ""}
        stepDescription={steps[2]?.description || ""}
        stepNumber={3}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
      />

      {/* Step 4: Parameters */}
      <ParameterSection
        validParameterIds={videoData?.valid_parameter_ids || []}
        parameterMapping={parameterMapping}
        selectedParameterIds={formData.parameterIds || []}
        searchTerm=""
        minMax={{ min: 1, max: 2 }}
        onParameterIdsChange={(ids) => handleInputChange("parameterIds", ids)}
        onSearchTermChange={() => {}}
        onMinMaxChange={() => {}}
        onRandomize={() => handleRandomizeVideo(["parameters"], "parameters")}
        onReset={() => {
          handleInputChange("parameterIds", []);
          setCurrentParameterItemIds([]);
        }}
        stepStatus={getStepStatus("parameters")}
        stepTitle={steps[3]?.title || ""}
        stepDescription={steps[3]?.description || ""}
        stepNumber={4}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
      />

      {/* Individual Parameter Sections */}
      {Object.entries(generalVideoParameterMapping).map(
        ([paramId, param], index) => {
          const stepIndex = 4 + index;
          const stepId = `parameter-${paramId}`;
          const stepStatus = getStepStatus(stepId);
          const validItemsForParam = validGeneralParameterItemIds.filter(
            (itemId) => fieldMapping[itemId]?.parameter_id === paramId
          );
          const selectedItemsForParam = currentParameterItemIds.filter(
            (itemId) => fieldMapping[itemId]?.parameter_id === paramId
          );

          return (
            <ParameterItemSection
              key={paramId}
              parameterId={paramId}
              parameter={param}
              validFieldIds={validItemsForParam}
              fieldMapping={fieldMapping}
              selectedFieldIds={selectedItemsForParam}
              minMax={{ min: 1, max: 2 }}
              onFieldIdsChange={(newIds) => {
                const otherFieldIds = currentParameterItemIds.filter(
                  (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                );
                setCurrentParameterItemIds([...otherFieldIds, ...newIds]);
              }}
              onMinMaxChange={() => {}}
              onRandomize={() => {}}
              onReset={() => {
                const otherFieldIds = currentParameterItemIds.filter(
                  (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                );
                setCurrentParameterItemIds(otherFieldIds);
              }}
              stepStatus={stepStatus}
              stepNumber={stepIndex + 1}
              isReadonly={isReadonly}
              isEditMode={isEditMode}
            />
          );
        }
      )}

      {/* Step 5: Content (Outline, Questions, Images, Video) */}
      <VideoContentSection
        outline={outlineText}
        outlineMapping={outlineMapping}
        currentOutlineIds={currentOutlineIds}
        hasOutlineChanges={hasOutlineChanges}
        originalOutline={
          isEditMode &&
          videoDetail &&
          videoDetail.outline_ids &&
          videoDetail.outline_ids.length > 0
            ? outlineMapping[videoDetail.outline_ids[0]!]?.outline || ""
            : ""
        }
        questionCountRange={
          videoData?.question_count_range
            ? {
                min: videoData.question_count_range.min,
                max: videoData.question_count_range.max,
              }
            : { min: 0, max: 3 }
        }
        questionCount={questionCount}
        onQuestionCountChange={(min, max) => setQuestionCount([min, max])}
        questions={questions}
        useImage={useImage}
        images={images}
        imageMapping={imageMapping}
        isUploadingImage={isUploadingImage}
        allPreviewDocumentIds={selectedDocumentIds}
        documentMapping={documentMapping}
        videoPreviewDocumentId={videoPreviewDocumentId}
        generatedVideoUrl={generatedVideoUrl}
        uploadedVideoFile={uploadedVideoFile}
        videoObjectUrl={videoObjectUrl}
        isUploadingVideo={isUploadingVideo}
        isGenerating={isGenerating}
        onOutlineChange={setOutlineText}
        onOutlineVersionSelect={handleOutlineVersionSelect}
        onResetOutline={handleResetOutline}
        onQuestionsChange={setQuestions}
        onAddQuestion={handleAddQuestion}
        onRemoveQuestion={handleRemoveQuestion}
        onUpdateQuestion={handleUpdateQuestion}
        onQuestionTimesChange={handleQuestionTimesChange}
        onOptionChange={handleOptionChange}
        onAddOption={handleAddOption}
        onRemoveOption={handleRemoveOption}
        onToggleOptionCorrect={handleToggleOptionCorrect}
        onUseImageChange={(checked) => {
          setUseImage(checked);
          if (!checked) {
            setImages([]);
          }
        }}
        onImageSelect={handleImageSelect}
        onImageUpload={handleImageUpload}
        onImageRemove={(index) => {
          setImages((prev) => prev.filter((_, i) => i !== index));
        }}
        onVideoPreviewDocumentChange={(docId) =>
          setVideoPreviewDocumentId(docId)
        }
        onGenerate={handleGenerate}
        onResetContent={handleResetContent}
        onDragStartQuestion={handleDragStartQuestion}
        onDragOverQuestion={handleDragOverQuestion}
        onDropQuestion={handleDropQuestion}
        onDragStartOption={handleDragStartOption}
        onDragOverOption={handleDragOverOption}
        onDropOption={handleDropOption}
        stepStatus={getStepStatus("outline")}
        stepTitle={steps[4]?.title || ""}
        stepDescription={steps[4]?.description || ""}
        stepNumber={5}
        isReadonly={isReadonly}
        isSubmitting={isSubmitting}
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        onVideoUpload={handleFileSelect}
        videoRef={videoRef}
        draggedQuestionIndex={draggedQuestionIndex}
        draggedOptionIndex={draggedOptionIndex}
      />

      {/* Action Buttons */}
      <div className="flex gap-2 justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/create/videos")}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || isReadonly}>
          {isSubmitting
            ? isEditMode
              ? "Updating..."
              : "Creating..."
            : isEditMode
              ? "Update Video"
              : "Create Video"}
        </Button>
      </div>
    </div>
  );
}
