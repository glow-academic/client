/**
 * Video.tsx
 * Video creation and editing component with interactive question timeline
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
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
  randomizeVideoAction: _randomizeVideoAction,
  generateOutlineAction: _generateOutlineAction,
  generateVideoAction: _generateVideoAction,
}: VideoProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!videoId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Helper function to update URL with query parameters
  const updateUrlParams = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || (Array.isArray(value) && value.length === 0)) {
          params.delete(key);
        } else if (Array.isArray(value)) {
          // Use comma-separated values to match how page.tsx reads them
          params.set(key, value.join(","));
        } else {
          params.set(key, value);
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router]
  );

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
    if (currentFieldIds.length > 0) {
      createPayload.parameter_item_ids = currentFieldIds;
    }
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      createPayload.parameter_ids = formData.parameterIds;
    }
    // Note: outline_agent_id is not supported in create endpoint
    // It will be set via update after creation if needed

    return createPayload;
  };

  // Parameter actions - Server-side randomization per parameter
  const handleRandomizeParameterClient = (paramId: string) => {
    // Set loading state for this specific parameter section
    setRandomizingSection(`parameter_${paramId}`);
    // Keep fields for other parameters in URL to avoid flash
    // Keep existing fields in local state too - randomized ones will merge via randomized_selections useEffect
    const filteredFieldIds = currentFieldIds.filter(
      (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
    );
    // Update URL: keep fields for other parameters, add randomize param
    // Server will randomize fields for this parameter and return them
    // The randomized_selections useEffect will merge randomized fields with existing ones
    updateUrlParams({
      fieldIds: filteredFieldIds.length > 0 ? filteredFieldIds : null,
      randomize: `parameter_${paramId}`,
    });
    // Don't clear local state - keep existing items until server returns randomized ones
    // The randomized_selections useEffect will merge and update state
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  // Persona actions - Server-side randomization
  const handleRandomizePersonaClient = () => {
    // Set loading state for persona section
    setRandomizingSection("persona");
    // Keep existing personaIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "persona",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  // Documents actions - Server-side randomization
  const handleRandomizeDocumentsClient = () => {
    // Set loading state for document section
    setRandomizingSection("document");
    // Keep existing documentIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "document",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
  };

  // Parameters actions - Server-side randomization
  const handleRandomizeParametersClient = () => {
    // Keep existing parameterIds in URL to avoid flash of empty state
    // Server will randomize and return new values, which will update URL via randomized_selections useEffect
    updateUrlParams({
      randomize: "parameters",
    });
    // Don't clear local state - keep existing values until server returns randomized ones
    // Trigger page refresh to get randomized results from server
    router.refresh();
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
    let generatedVideoUrl: string | null = null;

    try {
      // WebSocket payload type (not using GenerateOutlineIn since it's never)
      const body = {
        departmentId,
        documentIds: selectedDocumentIds,
        questionIds: null as string[] | null, // Questions are now generated by outline agent if questionsMax > 0
        parameterItemIds:
          currentFieldIds.length > 0 ? currentFieldIds : undefined,
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
            // Update URL params with generated question IDs
            setUrlQuestionIds((prev) => {
              const newIds = [...prev];
              data.question_ids.forEach((id) => {
                if (!newIds.includes(id)) {
                  newIds.push(id);
                }
              });
              return newIds;
            });
          }
        };

        const handleOutlineComplete = (data: {
          success: boolean;
          outline_id: string;
          trace_id?: string;
          message?: string;
        }) => {
          if (data.success) {
            // Update URL params with generated outline ID
            setUrlOutlineIds((prev) => {
              if (prev.includes(data.outline_id)) {
                return prev;
              }
              return [...prev, data.outline_id];
            });
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

        const handleVideoComplete = (_data: {
          success: boolean;
          generation_id?: string;
          trace_id?: string;
          message?: string;
        }) => {
          // Video generation completion is handled separately via video_generation_complete
        };

        const handleDocumentComplete = (_data: {
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
            // Update URL params with generated video ID if provided
            if (data.videoId) {
              setUrlVideoIds((prev) => {
                if (prev.includes(data.videoId!)) {
                  return prev;
                }
                return [...prev, data.videoId!];
              });
            }
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
          parameterItemIds:
            currentFieldIds.length > 0 ? currentFieldIds : undefined,
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
          // Update URL params with outline ID
          setUrlOutlineIds((prev) => {
            if (prev.includes(result.outline_id!)) {
              return prev;
            }
            return [...prev, result.outline_id!];
          });
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

  // Persona actions - Reset
  const handleResetPersona = () => {
    try {
      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams({
        personaIds: null,
        personaSearch: null,
        personaMin: null,
        personaMax: null,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        handleInputChange("personaIds", []);
        setPersonaSearchTerm("");
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Persona reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset persona");
    }
  };

  // Documents actions - Reset
  const handleResetDocuments = () => {
    try {
      // Get default min/max from server or use defaults
      const serverRanges = videoData?.allowed_ranges;
      const documentDefault = serverRanges?.document || { min: 0, max: 1 };
      const defaultMin = documentDefault.min;
      const defaultMax = documentDefault.max;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams({
        documentIds: null,
        documentSearch: null,
        documentMin: null,
        documentMax: null,
        randomize: null,
      });

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        setDocumentMinMax({ min: defaultMin, max: defaultMax });
        setSelectedDocumentIds([]);
        setDocumentSearchTerm("");
        setPreviewDocumentId(null);
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Documents reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset documents");
    }
  };

  // Parameters actions - Reset
  const handleResetParameters = () => {
    try {
      // Get default min/max from server or use defaults
      const newData = videoData as VideoNewOut | undefined;
      const defaultMin = newData?.parameter_selection_min ?? 0;
      const defaultMax = newData?.parameter_selection_max ?? 3;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Build URL updates - clear parameter IDs, search, ranges, and ALL field IDs
      const urlUpdates: Record<string, string | string[] | null> = {
        parameterIds: null,
        parameterSearch: null,
        parameterSelectionMin: null,
        parameterSelectionMax: null,
        fieldIds: null, // Clear all field IDs when resetting parameters
        randomize: null,
      };

      // Clear all field range params for ALL parameters (including defaults)
      // Use parameterMapping (all parameters) not generalVideoParameterMapping (filtered)
      Object.keys(parameterMapping).forEach((paramId) => {
        urlUpdates[`fieldMin_${paramId}`] = null;
        urlUpdates[`fieldMax_${paramId}`] = null;
      });

      // Also clear any fieldMin_* or fieldMax_* params from URL that we might have missed
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          urlUpdates[key] = null;
        }
      });

      // Clear URL params FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        setParameterSelectionMinMax({ min: defaultMin, max: defaultMax });
        handleInputChange("parameterIds", []);
        setParameterSearchTerm("");
        // Clear all field IDs when resetting parameters
        setCurrentFieldIds([]);
        // Reset field ranges to defaults for ALL parameters
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success("Parameters reset");
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset parameters");
    }
  };

  // Parameter actions - Reset per parameter
  const handleResetParameter = (paramId: string) => {
    try {
      // Get default min/max for this parameter from server or use defaults
      const newData = videoData as VideoNewOut | undefined;
      const serverFieldRanges = newData?.field_ranges || {};
      const serverRange = serverFieldRanges[paramId];
      const defaultMin = serverRange?.min ?? 1;
      const defaultMax = serverRange?.max ?? 3;

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Remove this parameter's items from URL params and local state
      const currentParamItems = currentFieldIds.filter(
        (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
      );

      // Build URL updates - clear field IDs and range params for this parameter
      const urlUpdates: Record<string, string | string[] | null> = {
        fieldIds: currentParamItems.length > 0 ? currentParamItems : null,
        randomize: null,
      };
      // Clear range params for this parameter
      urlUpdates[`fieldMin_${paramId}`] = null;
      urlUpdates[`fieldMax_${paramId}`] = null;

      // Clear URL params FIRST, then update state after URL update completes
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      requestAnimationFrame(() => {
        // Reset local state for this parameter's range
        setFieldMinMax((prev) => ({
          ...prev,
          [paramId]: { min: defaultMin, max: defaultMax },
        }));
        // Update local state - remove this parameter's fields
        setCurrentFieldIds(currentParamItems);
        // Refresh after state updates to get fresh server data
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });

      toast.success(
        `${generalVideoParameterMapping[paramId]?.name || "Parameter"} reset`
      );
    } catch {
      isResettingRef.current = false;
      toast.error("Failed to reset parameter");
    }
  };

  // Randomize all: personas, documents, and all parameters (server-side via URL params)
  const handleRandomizeAll = () => {
    try {
      // Set loading state for all sections
      setRandomizingSection("all");
      // Keep existing IDs in URL to avoid flash of empty state
      // Server will randomize and return new values, which will update URL via randomized_selections useEffect
      // Server randomizes from the full filtered set regardless of existing selections
      updateUrlParams({
        randomize: "all",
      });

      // Trigger page refresh to get randomized results from server
      router.refresh();
    } catch {
      toast.error("Failed to randomize all selections");
    }
  };

  // Reset all: personas, documents, and all parameters (clear URL params)
  const handleResetAll = () => {
    try {
      // Clear all URL params first - server will return defaults
      // Build URL updates - clear all params including ranges
      const urlUpdates: Record<string, string | null> = {
        departmentIds: null,
        personaIds: null,
        documentIds: null,
        parameterIds: null,
        fieldIds: null,
        personaSearch: null,
        documentSearch: null,
        parameterSearch: null,
        personaMin: null,
        personaMax: null,
        documentMin: null,
        documentMax: null,
        parameterSelectionMin: null,
        parameterSelectionMax: null,
        randomize: null,
      };

      // Clear all field range params for ALL parameters (including defaults)
      // Use parameterMapping (all parameters) not generalVideoParameterMapping (filtered)
      // Also clear any fieldMin_* or fieldMax_* params that might exist in URL but not in current mapping
      Object.keys(parameterMapping).forEach((paramId) => {
        urlUpdates[`fieldMin_${paramId}`] = null;
        urlUpdates[`fieldMax_${paramId}`] = null;
      });

      // Also clear any fieldMin_* or fieldMax_* params from URL that we might have missed
      // This handles edge cases where params exist but aren't in current parameterMapping
      searchParams.forEach((_value, key) => {
        if (key.startsWith("fieldMin_") || key.startsWith("fieldMax_")) {
          urlUpdates[key] = null;
        }
      });

      // Set resetting flag to prevent buildSearchParams from interfering
      isResettingRef.current = true;

      // Update URL FIRST, then update state after URL update completes
      // This prevents buildSearchParams useEffect from re-adding params
      updateUrlParams(urlUpdates);

      // Update local state after URL update completes (next frame)
      // This ensures URL is cleared before state updates trigger buildSearchParams
      requestAnimationFrame(() => {
        // Reset all local state to defaults for instant UI feedback
        // Server response will sync these values properly via useEffect
        setDocumentMinMax({ min: 0, max: 1 });
        setParameterSelectionMinMax({ min: 0, max: 3 });

        // Reset field ranges to defaults for ALL parameters (including defaults)
        // Use parameterMapping (all parameters) not generalVideoParameterMapping (filtered)
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);

        const questionDefault = videoData?.question_count_range || {
          min: 0,
          max: 3,
        };
        setQuestionCount([questionDefault.min, questionDefault.max]);

        // Reset all search terms
        setPersonaSearchTerm("");
        setDocumentSearchTerm("");
        setParameterSearchTerm("");

        // Reset all selections
        handleInputChange("personaIds", []);
        setSelectedDocumentIds([]);
        setCurrentFieldIds([]);
        handleInputChange("parameterIds", []);
        setPreviewDocumentId(null);
        setSelectedOutlineId(null);
        setOutlineText("");
        setImages([]);
        setUseImage(false);
        setQuestions([]);

        // Refresh after state updates to get fresh server data
        // The useEffect will sync state from server response
        router.refresh();
        // Reset flag after refresh completes
        setTimeout(() => {
          isResettingRef.current = false;
        }, 200);
      });
      toast.success("All selections reset");
    } catch {
      isResettingRef.current = false;
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
                parameter_item_ids: currentVideo?.parameter_item_ids || [],
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
  const [documentSearchTerm, setDocumentSearchTerm] = useState<string>("");
  // Persona and parameter search terms (matching scenarios pattern)
  const [personaSearchTerm, setPersonaSearchTerm] = useState<string>("");
  const [parameterSearchTerm, setParameterSearchTerm] = useState<string>("");
  const [documentMinMax, setDocumentMinMax] = useState<{
    min: number;
    max: number;
  }>(() => {
    // Initialize from URL params or server-provided default
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const min = params.get("documentMin");
      const max = params.get("documentMax");
      if (min !== null && max !== null) {
        return { min: parseInt(min, 10), max: parseInt(max, 10) };
      }
    }
    // Fallback only if server doesn't provide ranges (will be updated when videoData loads)
    return { min: 0, max: 3 };
  });
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );
  const [templateDocumentIds, setTemplateDocumentIds] = useState<string[]>([]);
  const [originalTemplateDocumentIds, setOriginalTemplateDocumentIds] =
    useState<string[]>([]);

  // Parameter state
  const [currentFieldIds, setCurrentFieldIds] = useState<string[]>([]);
  // Parameter selection range state: [min, max] - initialized from server or URL params
  const [parameterSelectionMinMax, setParameterSelectionMinMax] = useState(
    () => {
      if (videoData && "parameter_selection_min" in videoData) {
        const newData = videoData as VideoNewOut;
        return {
          min: newData.parameter_selection_min ?? 0,
          max: newData.parameter_selection_max ?? 3,
        };
      }
      // Fallback to allowed range if server data not available yet
      const ranges = videoData?.allowed_ranges;
      return ranges?.parameter_selection
        ? {
            min: ranges.parameter_selection.min,
            max: ranges.parameter_selection.max,
          }
        : { min: 0, max: 3 };
    }
  );
  // Field ranges state: per-parameter min/max - initialized from server or URL params
  const [fieldMinMax, setFieldMinMax] = useState<
    Record<string, { min: number; max: number }>
  >(() => {
    // Use field_ranges (current values) if available, otherwise use allowed_ranges.fields
    if (videoData && "field_ranges" in videoData) {
      const newData = videoData as VideoNewOut;
      if (newData.field_ranges) {
        const result: Record<string, { min: number; max: number }> = {};
        Object.entries(newData.field_ranges).forEach(([paramId, range]) => {
          // Handle undefined values with defaults - type assertion needed for index signature
          const typedRange = range as { min?: number; max?: number };
          result[paramId] = {
            min: typedRange.min ?? 1,
            max: typedRange.max ?? 3,
          };
        });
        return result;
      }
    }
    // Fallback to allowed_ranges.fields if server data not available yet
    const ranges = videoData?.allowed_ranges;
    if (!ranges?.fields) return {};
    const result: Record<string, { min: number; max: number }> = {};
    Object.entries(ranges.fields).forEach(([paramId, range]) => {
      result[paramId] = { min: range.min, max: range.max };
    });
    return result;
  });

  // Video generation state
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(
    null
  );
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

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

  const handleInputChange = useCallback(
    <K extends keyof FormData>(field: K, value: FormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error for this field
      setErrors((prev) => {
        if (prev[field]) {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        }
        return prev;
      });
    },
    []
  );

  const formDataInitializedRef = useRef<boolean>(false);
  // Track last processed randomized_selections to prevent re-processing
  const lastProcessedRandomizedRef = useRef<string | null>(null);
  // Track if we're currently applying randomized selections to skip URL updates
  const isApplyingRandomizedRef = useRef<boolean>(false);
  // Track which section is currently being randomized for loading indicators
  const [randomizingSection, setRandomizingSection] = useState<
    "persona" | "document" | "parameters" | `parameter_${string}` | "all" | null
  >(null);
  // Use transition for smooth UI updates during randomization
  const [isPending, startTransition] = useTransition();

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

  // Use server-provided filtered valid IDs (replacing client-side filtering)
  // Server now handles all filtering logic based on query parameters
  const validPersonaIds = useMemo(() => {
    return videoData?.valid_persona_ids || [];
  }, [videoData?.valid_persona_ids]);

  // Use server-provided filtered valid document IDs
  const validDocumentIds = useMemo(() => {
    return videoData?.valid_document_ids || [];
  }, [videoData?.valid_document_ids]);

  // Filter valid parameter item IDs by parameter type
  const validParameterItemIds = useMemo(() => {
    // Use server-provided filtered IDs if available, otherwise fall back to mapping keys
    if (videoData?.valid_field_ids) {
      return videoData.valid_field_ids;
    }
    // Fallback: Get all parameter item IDs from mapping that belong to video parameters
    const allVideoParamItemIds = Object.keys(fieldMapping).filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return Object.keys(parameterMapping).includes(paramId);
    });
    return allVideoParamItemIds;
  }, [videoData?.valid_field_ids, fieldMapping, parameterMapping]);

  const _validDocumentParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, fieldMapping, documentParameterIds]);

  const _validGeneralVideoParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = fieldMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalVideoParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, fieldMapping, generalVideoParameterIds]);

  // Build parameter mappings filtered by type
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

  // Generated resource IDs state (for URL tracking) - must be declared before buildSearchParams
  const [urlOutlineIds, setUrlOutlineIds] = useState<string[]>([]);
  const [urlQuestionIds, setUrlQuestionIds] = useState<string[]>([]);
  const [urlVideoIds, setUrlVideoIds] = useState<string[]>([]);

  // Build search params from current state
  const buildSearchParams = useCallback(() => {
    const params = new URLSearchParams();

    // Add filter params (always include if non-empty)
    // Use comma-separated values to match how page.tsx reads them (searchParams.get().split(","))
    if (formData.departmentIds && formData.departmentIds.length > 0) {
      params.set("departmentIds", formData.departmentIds.join(","));
    }
    if (formData.personaIds && formData.personaIds.length > 0) {
      params.set("personaIds", formData.personaIds.join(","));
    }
    if (selectedDocumentIds.length > 0) {
      params.set("documentIds", selectedDocumentIds.join(","));
    }
    if (templateDocumentIds.length > 0) {
      params.set("templateDocumentIds", templateDocumentIds.join(","));
    }
    if (formData.parameterIds && formData.parameterIds.length > 0) {
      params.set("parameterIds", formData.parameterIds.join(","));
    }
    if (currentFieldIds.length > 0) {
      params.set("fieldIds", currentFieldIds.join(","));
    }
    if (urlOutlineIds.length > 0) {
      params.set("outlineIds", urlOutlineIds.join(","));
    }
    if (urlQuestionIds.length > 0) {
      params.set("questionIds", urlQuestionIds.join(","));
    }
    if (urlVideoIds.length > 0) {
      params.set("videoIds", urlVideoIds.join(","));
    }

    // Add search params when non-empty
    if (personaSearchTerm.trim()) {
      params.set("personaSearch", personaSearchTerm);
    }
    if (documentSearchTerm.trim()) {
      params.set("documentSearch", documentSearchTerm);
    }
    if (parameterSearchTerm.trim()) {
      params.set("parameterSearch", parameterSearchTerm);
    }

    // Add range params when different from server-provided current values
    // Compare against server's current values (persona_min/persona_max), not allowed_ranges
    const serverCurrentValues = videoData as VideoNewOut | undefined;

    // Persona ranges - compare against server's current values (videos don't have persona ranges in URL, but include for consistency)
    // Note: Videos don't use personaMin/personaMax in URL, but we'll keep the structure consistent

    // Document ranges - compare against server's current values
    const serverDocumentMin = serverCurrentValues?.document_min ?? 0;
    const serverDocumentMax = serverCurrentValues?.document_max ?? 1;
    if (
      documentMinMax.min !== serverDocumentMin ||
      documentMinMax.max !== serverDocumentMax
    ) {
      params.set("documentMin", documentMinMax.min.toString());
      params.set("documentMax", documentMinMax.max.toString());
    }

    // Parameter selection ranges - compare against server's current values
    const serverParameterMin =
      serverCurrentValues?.parameter_selection_min ?? 0;
    const serverParameterMax =
      serverCurrentValues?.parameter_selection_max ?? 3;
    if (
      parameterSelectionMinMax.min !== serverParameterMin ||
      parameterSelectionMinMax.max !== serverParameterMax
    ) {
      params.set(
        "parameterSelectionMin",
        parameterSelectionMinMax.min.toString()
      );
      params.set(
        "parameterSelectionMax",
        parameterSelectionMinMax.max.toString()
      );
    }

    // Per-parameter field ranges - compare against server's current values
    // Include ranges for selected parameters, or for all parameters if randomize=all (server needs ranges for randomized params)
    const selectedParamIds = formData.parameterIds || [];
    const isRandomizing = searchParams.get("randomize") === "all";
    const serverFieldRanges = serverCurrentValues?.field_ranges || {};
    Object.entries(fieldMinMax).forEach(([fieldId, range]) => {
      // Include range if:
      // 1. Parameter is selected, OR
      // 2. We're randomizing all (server will randomize parameters and need these ranges)
      // AND range differs from server's current value
      const shouldInclude = isRandomizing || selectedParamIds.includes(fieldId);
      // Get the parameter_id for this field to find its range in server response
      const fieldParamId = fieldMapping[fieldId]?.parameter_id;
      const serverFieldRange = fieldParamId
        ? serverFieldRanges[fieldParamId]
        : undefined;
      const fieldDefault = serverFieldRange || {
        min: 1,
        max: 3,
      };
      if (
        shouldInclude &&
        (range.min !== fieldDefault.min || range.max !== fieldDefault.max)
      ) {
        params.set(`fieldMin_${fieldId}`, range.min.toString());
        params.set(`fieldMax_${fieldId}`, range.max.toString());
      }
    });

    // Question ranges - compare against server defaults
    const questionRange = videoData?.question_count_range;
    const questionDefault = questionRange || { min: 0, max: 3 };
    if (
      questionCount[0] !== questionDefault.min ||
      questionCount[1] !== questionDefault.max
    ) {
      params.set("questionMin", questionCount[0].toString());
      params.set("questionMax", questionCount[1].toString());
    }

    return params;
  }, [
    formData.departmentIds,
    formData.personaIds,
    formData.parameterIds,
    selectedDocumentIds,
    templateDocumentIds,
    currentFieldIds,
    urlOutlineIds,
    urlQuestionIds,
    urlVideoIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    questionCount,
    videoData, // Include full videoData to access current values (document_min, document_max, etc.)
    searchParams, // Include searchParams to check for randomize param
    fieldMapping, // Include fieldMapping for field range logic
  ]);

  // Debounce timeout ref for URL updates
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track last params string to prevent duplicate updates
  const lastParamsStringRef = useRef<string>("");
  // Track if we're currently resetting to prevent buildSearchParams from interfering
  const isResettingRef = useRef<boolean>(false);

  // Helper to normalize URLSearchParams for comparison (sort keys and values)
  const normalizeParamsString = (params: URLSearchParams): string => {
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    return sorted;
  };

  // Update URL params when selections change (for server-driven filtering)
  // Follows analytics pattern: Form state → URL → router.refresh() → Server re-fetch → Filtered data
  // Server already parses URL params and returns filtered data, so no need for URL → Form sync
  useEffect(() => {
    // Skip URL updates if we're currently applying randomized selections
    // This prevents infinite loops when randomized selections trigger state updates
    if (isApplyingRandomizedRef.current) {
      return;
    }

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce URL updates (100ms, like analytics)
    // Skip if we're currently resetting (prevents re-adding params that were just cleared)
    debounceTimeoutRef.current = setTimeout(() => {
      // Skip buildSearchParams if we're resetting - let reset handlers manage URL directly
      if (isResettingRef.current) {
        return;
      }

      const newParams = buildSearchParams();
      const newParamsString = normalizeParamsString(newParams);
      const currentParamsString = normalizeParamsString(searchParams);

      // Only update URL if params actually changed (prevents unnecessary updates and loops)
      if (
        newParamsString !== currentParamsString &&
        newParamsString !== lastParamsStringRef.current
      ) {
        lastParamsStringRef.current = newParamsString;
        // Use updateUrlParams helper instead of direct router.replace
        const updates: Record<string, string | string[] | null> = {};
        newParams.forEach((value, key) => {
          updates[key] = value;
        });
        updateUrlParams(updates);
        // Force server components to re-render with updated search params (like analytics)
        router.refresh();
      }
    }, 100);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
    // Remove buildSearchParams from dependencies - it's already covered by its own dependencies
    // Remove searchParams and router from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.departmentIds,
    formData.personaIds,
    selectedDocumentIds,
    templateDocumentIds,
    formData.parameterIds,
    currentFieldIds,
    urlOutlineIds,
    urlQuestionIds,
    urlVideoIds,
    personaSearchTerm,
    documentSearchTerm,
    parameterSearchTerm,
    documentMinMax,
    parameterSelectionMinMax,
    fieldMinMax,
    questionCount,
    pathname,
  ]);

  // Sync URL params to state on initial load (for create mode)
  useEffect(() => {
    if (!isEditMode && videoData) {
      // Initialize outline IDs from URL params
      const outlineIdsFromUrl =
        searchParams.get("outlineIds")?.split(",").filter(Boolean) || [];
      if (outlineIdsFromUrl.length > 0) {
        setUrlOutlineIds(outlineIdsFromUrl);
      }

      // Initialize question IDs from URL params
      const questionIdsFromUrl =
        searchParams.get("questionIds")?.split(",").filter(Boolean) || [];
      if (questionIdsFromUrl.length > 0) {
        setUrlQuestionIds(questionIdsFromUrl);
      }

      // Initialize video IDs from URL params
      const videoIdsFromUrl =
        searchParams.get("videoIds")?.split(",").filter(Boolean) || [];
      if (videoIdsFromUrl.length > 0) {
        setUrlVideoIds(videoIdsFromUrl);
      }

      // Initialize template document IDs from URL params (create mode)
      // Server may provide selected_template_document_ids in future, but for now use URL params
      const templateDocumentIdsFromUrl = searchParams
        .get("templateDocumentIds")
        ?.split(",")
        .filter(Boolean);
      if (templateDocumentIdsFromUrl && templateDocumentIdsFromUrl.length > 0) {
        setTemplateDocumentIds(templateDocumentIdsFromUrl);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEditMode]);

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

      // Load field IDs
      if (videoData.parameter_item_ids) {
        setCurrentFieldIds(videoData.parameter_item_ids);
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
          setUrlOutlineIds(videoDetail.outline_ids);
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
            setUrlOutlineIds([firstOutlineId]);
          }
        }
      }

      // Load documents
      if (videoData.document_ids) {
        setSelectedDocumentIds(videoData.document_ids);
        // Initialize preview document to first document if available (only on initial load)
        if (
          videoData.document_ids.length > 0 &&
          !formDataInitializedRef.current &&
          !previewDocumentId
        ) {
          setPreviewDocumentId(videoData.document_ids[0] || null);
        }
      }
      // Extract template document IDs from documentDetails (is_template field) for edit mode
      const videoDataWithDetails = videoData as VideoDetailOut & {
        document_details?: Array<{
          document_id: string;
          is_template?: boolean;
          [key: string]: unknown;
        }>;
      };
      const templateDocIds =
        videoDataWithDetails.document_details
          ?.filter((doc) => doc.is_template === true)
          .map((doc) => doc.document_id) || [];
      setTemplateDocumentIds(templateDocIds);
      // Store template document IDs for original tracking (already extracted above as templateDocIds)
      setOriginalTemplateDocumentIds(templateDocIds);

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
        // Add video ID to URL params if videoId exists
        if (videoId) {
          setUrlVideoIds([videoId]);
        }
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
        // Extract question IDs for URL params
        const questionIds = loadedQuestions
          .map((q) => q.question_id)
          .filter((id): id is string => !!id);
        if (questionIds.length > 0) {
          setUrlQuestionIds(questionIds);
        }
      }

      formDataInitializedRef.current = true;
    } else if (!isEditMode && videoData && !formDataInitializedRef.current) {
      // Create mode: initialize from server response (server-driven approach)
      // Server already parsed URL params and returns selected IDs, search terms, ranges
      const newData = videoData as VideoNewOut;
      setFormData({
        ...initialFormData,
        outlineAgentId: videoData.outline_agent_id || null,
        imageAgentId: videoData.image_agent_id || null,
        videoAgentId: videoData.video_agent_id || null,
        parameterIds: newData.selected_parameter_ids || [],
      });

      // Initialize selections from server response (filtered to valid IDs)
      if (newData.selected_persona_ids) {
        handleInputChange("personaIds", newData.selected_persona_ids);
      }
      if (newData.selected_document_ids) {
        setSelectedDocumentIds(newData.selected_document_ids);
      }
      // Template document IDs come from URL params (server returns selected_template_document_ids)
      if (newData.selected_template_document_ids) {
        setTemplateDocumentIds(newData.selected_template_document_ids);
      }
      if (newData.selected_field_ids) {
        setCurrentFieldIds(newData.selected_field_ids);
      }

      // Initialize search terms from server response
      if (newData.persona_search) {
        setPersonaSearchTerm(newData.persona_search);
      }
      if (newData.document_search) {
        setDocumentSearchTerm(newData.document_search);
      }
      if (newData.parameter_search) {
        setParameterSearchTerm(newData.parameter_search);
      }

      // Initialize range values from server response (current values, not allowed ranges)
      // Always set from server response if available, default to 1
      // Always update to ensure reset works properly (even if values match defaults)
      // Note: Videos don't use persona ranges in URL params like scenarios do
      // Always update document ranges (not conditional) to ensure reset works
      setDocumentMinMax({
        min: newData.document_min ?? 0,
        max: newData.document_max ?? 1,
      });
      // Always update parameter selection ranges to ensure reset works
      const parameterDefault =
        videoData?.allowed_ranges?.parameter_selection ||
        parameterSelectionMinMax;
      setParameterSelectionMinMax({
        min: newData.parameter_selection_min ?? parameterDefault.min,
        max: newData.parameter_selection_max ?? parameterDefault.max,
      });

      // Initialize per-parameter field ranges from server response
      // Always update field ranges (even if empty) to ensure reset works
      if (newData.field_ranges) {
        const result: Record<string, { min: number; max: number }> = {};
        Object.entries(newData.field_ranges).forEach(([paramId, range]) => {
          // Type assertion needed for index signature - use bracket notation
          const typedRange = range as { min?: number; max?: number };
          result[paramId] = {
            min: typedRange["min"] ?? 1,
            max: typedRange["max"] ?? 3,
          };
        });
        setFieldMinMax(result);
      } else {
        // This ensures reset works even if server doesn't return field_ranges
        // Initialize defaults for all valid parameters
        const defaultFieldRanges: Record<string, { min: number; max: number }> =
          {};
        Object.keys(parameterMapping).forEach((paramId) => {
          defaultFieldRanges[paramId] = { min: 1, max: 3 };
        });
        setFieldMinMax(defaultFieldRanges);
      }

      // Initialize question count from server data or default to [0, 0]
      if (videoData?.question_count_range) {
        setQuestionCount([
          videoData.question_count_range.min || 0,
          videoData.question_count_range.max || 0,
        ]);
      }

      formDataInitializedRef.current = true;
    }
  }, [
    videoData,
    isEditMode,
    outlineMapping,
    videoDetail,
    videoId,
    previewDocumentId,
    parameterMapping,
    parameterSelectionMinMax,
    handleInputChange,
  ]);

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

  // Clear selections when they become invalid after department changes
  // (but preserve cross-department entities and staged selections)
  useEffect(() => {
    // Clear personas that are no longer valid
    if (formData.personaIds && formData.personaIds.length > 0) {
      const validSet = new Set(validPersonaIds);
      const filtered = formData.personaIds.filter((id) => validSet.has(id));
      if (filtered.length !== formData.personaIds.length) {
        handleInputChange("personaIds", filtered);
      }
    }
  }, [formData.personaIds, validPersonaIds, handleInputChange]);

  useEffect(() => {
    // Clear documents that are no longer valid
    if (selectedDocumentIds.length > 0) {
      const validSet = new Set(validDocumentIds);
      const filtered = selectedDocumentIds.filter((id) => validSet.has(id));
      if (filtered.length !== selectedDocumentIds.length) {
        setSelectedDocumentIds(filtered);
      }
    }
  }, [selectedDocumentIds, validDocumentIds]);

  useEffect(() => {
    // Clear parameter items that are no longer valid
    if (currentFieldIds.length > 0) {
      const validSet = new Set(validParameterItemIds);
      const filtered = currentFieldIds.filter((id) => validSet.has(id));
      if (filtered.length !== currentFieldIds.length) {
        setCurrentFieldIds(filtered);
      }
    }
  }, [currentFieldIds, validParameterItemIds]);

  // Handle randomized selections from server response
  useEffect(() => {
    // Only process if randomize param is present (prevents processing stale randomized_selections)
    const randomizeParam = searchParams.get("randomize");
    if (videoData?.randomized_selections && randomizeParam) {
      const randomized = videoData.randomized_selections;

      // Create a hash of the randomized selections to detect if we've already processed this
      const randomizedHash = JSON.stringify({
        personaIds: randomized.personaIds,
        documentIds: randomized.documentIds,
        parameterIds: randomized.parameterIds,
        fieldIds: randomized.fieldIds,
      });

      // Skip if we're currently applying randomized selections (prevents double-processing)
      if (isApplyingRandomizedRef.current) {
        // Still clear randomizing section to prevent infinite loading
        setRandomizingSection(null);
        return;
      }

      // If we've already processed this exact randomized selection, just clear the param and reset hash
      if (lastProcessedRandomizedRef.current === randomizedHash) {
        // Reset hash so next randomization (even if same result) can be processed
        lastProcessedRandomizedRef.current = null;
        // Clear randomizing section to prevent infinite loading
        setRandomizingSection(null);
        updateUrlParams({
          randomize: null,
        });
        return;
      }

      // Mark that we're applying randomized selections (prevents second useEffect from running)
      isApplyingRandomizedRef.current = true;
      lastProcessedRandomizedRef.current = randomizedHash;

      // Update state with randomized selections using transition for smooth UI updates
      // This ensures the old UI stays visible while new selections are being applied,
      // especially important for personas which sort selected ones first
      startTransition(() => {
        if (randomized.personaIds) {
          handleInputChange("personaIds", randomized.personaIds);
        }
        if (randomized.documentIds) {
          setSelectedDocumentIds(randomized.documentIds);
        }
        if (randomized.parameterIds) {
          handleInputChange("parameterIds", randomized.parameterIds);
        }
        // Clear randomizing section state when randomization completes
        setRandomizingSection(null);
      });

      // Compute merged fieldIds if needed (for single parameter randomization)
      let finalFieldIds: string[] | undefined;
      if (randomized.fieldIds && randomized.fieldIds.length > 0) {
        const randomizeParam = searchParams.get("randomize");
        if (randomizeParam && randomizeParam.startsWith("parameter_")) {
          // Single parameter randomization: keep fields for other parameters, add randomized ones
          const paramId = randomizeParam.replace("parameter_", "");
          // Compute merged fields before state update
          // Note: Using currentFieldIds and fieldMapping from closure - they're stable references

          const otherParamFields = currentFieldIds.filter(
            (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
          );
          finalFieldIds = [...otherParamFields, ...randomized.fieldIds];
          // Wrap field updates in transition too for smooth transitions
          startTransition(() => {
            setCurrentFieldIds(finalFieldIds!);
          });
        } else {
          // Full randomization (randomize=all): replace all fields
          finalFieldIds = randomized.fieldIds;
          startTransition(() => {
            setCurrentFieldIds(finalFieldIds!);
          });
        }
      }

      // Update URL params with randomized selections AND clear randomize param
      // This ensures URL reflects the randomized state (URL is source of truth)
      requestAnimationFrame(() => {
        const urlUpdates: Record<string, string | string[] | null> = {
          randomize: null, // Clear randomize param
        };

        // Add randomized IDs to URL params so URL reflects current state
        if (randomized.personaIds && randomized.personaIds.length > 0) {
          urlUpdates.personaIds = randomized.personaIds;
        }
        if (randomized.documentIds && randomized.documentIds.length > 0) {
          urlUpdates.documentIds = randomized.documentIds;
        }
        if (randomized.parameterIds && randomized.parameterIds.length > 0) {
          urlUpdates.parameterIds = randomized.parameterIds;
        }
        if (finalFieldIds && finalFieldIds.length > 0) {
          // Use the computed finalFieldIds (already merged if needed)
          urlUpdates.fieldIds = finalFieldIds;
        }

        updateUrlParams(urlUpdates);
        // Reset the flag after clearing params (use another frame to ensure URL update completes)
        requestAnimationFrame(() => {
          isApplyingRandomizedRef.current = false;
          // Ensure randomizing section is cleared even if transition didn't run
          setRandomizingSection(null);
        });
      });
    }
  }, [
    videoData?.randomized_selections,
    searchParams,
    updateUrlParams,
    handleInputChange,
    randomizingSection,
  ]);

  // Also handle randomized flag as fallback (DHH-style: server tells client when to clear param)
  // This ensures the param is cleared even if randomized_selections processing fails or gets stuck
  // Also updates URL with randomized IDs from main fields (persona_ids, document_ids, etc.)
  useEffect(() => {
    const randomizeParam = searchParams.get("randomize");
    if (videoData?.randomized === true && randomizeParam) {
      // Server has applied randomization to main fields - update URL with randomized IDs
      // Use a small delay to ensure randomized_selections useEffect has a chance to run first
      const timeoutId = setTimeout(() => {
        // Only process if param is still present (randomized_selections might have already handled it)
        if (searchParams.get("randomize")) {
          // Read randomized values from main fields and update URL params
          // This ensures URL reflects the randomized state even if randomized_selections didn't process
          // Use transition for smooth state updates
          startTransition(() => {
            if (videoData.persona_ids && videoData.persona_ids.length > 0) {
              handleInputChange("personaIds", videoData.persona_ids);
            }
            if (videoData.document_ids && videoData.document_ids.length > 0) {
              setSelectedDocumentIds(videoData.document_ids);
            }
            if (
              videoData.video_parameter_ids &&
              videoData.video_parameter_ids.length > 0
            ) {
              handleInputChange("parameterIds", videoData.video_parameter_ids);
            }
            // For fields, we need to use selected_field_ids
            const serverData = videoData as VideoNewOut | undefined;
            if (
              serverData?.selected_field_ids &&
              serverData.selected_field_ids.length > 0
            ) {
              setCurrentFieldIds(serverData.selected_field_ids);
            }
          });

          const fallbackUrlUpdates: Record<string, string | string[] | null> = {
            randomize: null, // Clear randomize param
          };

          // Update URL params to reflect randomized state
          if (videoData.persona_ids && videoData.persona_ids.length > 0) {
            fallbackUrlUpdates.personaIds = videoData.persona_ids;
          }
          if (videoData.document_ids && videoData.document_ids.length > 0) {
            fallbackUrlUpdates.documentIds = videoData.document_ids;
          }
          if (
            videoData.video_parameter_ids &&
            videoData.video_parameter_ids.length > 0
          ) {
            fallbackUrlUpdates.parameterIds = videoData.video_parameter_ids;
          }
          // For fields, we need to use selected_field_ids
          const fallbackServerData = videoData as VideoNewOut | undefined;
          if (
            fallbackServerData?.selected_field_ids &&
            fallbackServerData.selected_field_ids.length > 0
          ) {
            fallbackUrlUpdates.fieldIds = fallbackServerData.selected_field_ids;
          }

          // Reset flags to allow next randomization to be processed
          lastProcessedRandomizedRef.current = null;
          isApplyingRandomizedRef.current = false;
          // Clear randomizing section state
          setRandomizingSection(null);
          updateUrlParams(fallbackUrlUpdates);
        }
      }, 200);

      return () => clearTimeout(timeoutId);
    }
  }, [
    videoData?.randomized,
    videoData,
    searchParams,
    updateUrlParams,
    startTransition,
    handleInputChange,
  ]);

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
        if (currentFieldIds.length > 0) {
          updatePayload.parameter_item_ids = currentFieldIds;
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
          : currentFieldIds.length > 0
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

  // Smart questions management: automatically add/remove questions based on slider changes
  useEffect(() => {
    const [min, max] = questionCount;
    const currentLength = questions.length;

    // If questions are disabled (max === 0), clear all questions
    if (max === 0) {
      if (currentLength > 0) {
        setQuestions([]);
      }
      return;
    }

    // Ensure we have at least minimum questions (add blank ones if needed)
    if (currentLength < min) {
      const blankQuestionsToAdd = min - currentLength;
      setQuestions((prev) => [
        ...prev,
        ...Array(blankQuestionsToAdd)
          .fill(null)
          .map(() => ({
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
          })),
      ]);
      return;
    }

    // If maximum decreased, remove questions (empty ones first, then filled ones)
    if (currentLength > max) {
      setQuestions((prev) => {
        const next = [...prev];
        const toRemove = currentLength - max;

        // First, find and remove empty questions
        const emptyIndices: number[] = [];
        for (let i = next.length - 1; i >= 0; i--) {
          const question = next[i];
          if (
            !question ||
            !question.question_text ||
            question.question_text.trim() === ""
          ) {
            emptyIndices.push(i);
            if (emptyIndices.length >= toRemove) break;
          }
        }

        // Remove empty questions first
        let removed = 0;
        for (const idx of emptyIndices) {
          if (removed < toRemove) {
            next.splice(idx, 1);
            removed++;
          }
        }

        // If we still need to remove more, remove from the end (filled questions)
        while (next.length > max && removed < toRemove) {
          next.pop();
          removed++;
        }

        return next;
      });
      return;
    }

    // Ensure we don't exceed maximum (shouldn't happen with UI controls, but safety check)
    if (currentLength > max) {
      setQuestions((prev) => prev.slice(0, max));
    }
  }, [questionCount, questions.length]); // Only depend on length, not content, to avoid loops

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

  // Video preview document ID state
  const [videoPreviewDocumentId, setVideoPreviewDocumentId] = useState<
    string | null
  >(null);

  // Initialize/update videoPreviewDocumentId when selectedDocumentIds changes
  useEffect(() => {
    if (selectedDocumentIds.length > 0) {
      // If current preview is not in the selected documents, or no preview is set, select the first one
      const firstDocId = selectedDocumentIds[0];
      if (
        !videoPreviewDocumentId ||
        (firstDocId && !selectedDocumentIds.includes(videoPreviewDocumentId))
      ) {
        setVideoPreviewDocumentId(firstDocId || null);
      }
    } else {
      // No documents selected, clear preview
      setVideoPreviewDocumentId(null);
    }
  }, [selectedDocumentIds, videoPreviewDocumentId]);

  // Template document IDs are managed via:
  // - Edit mode: extracted from documentDetails (is_template field) in useEffect above
  // - Create mode: loaded from server response (selected_template_document_ids)
  // - URL params: single source of truth, server provides selected_template_document_ids
  // No need for document_mapping derivation - matches Scenario.tsx pattern

  // Video upload state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);

  // Create object URL when file changes
  useEffect(() => {
    if (uploadedVideoFile) {
      const url = URL.createObjectURL(uploadedVideoFile);
      setVideoObjectUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setVideoObjectUrl(null);
      return undefined;
    }
  }, [uploadedVideoFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("video/")) {
      handleVideoUpload(file);
    }
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
            searchTerm={personaSearchTerm}
            minMax={videoData?.allowed_ranges?.persona || { min: 1, max: 3 }}
            onPersonaIdsChange={(ids) => handleInputChange("personaIds", ids)}
            onSearchTermChange={setPersonaSearchTerm}
            onMinMaxChange={() => {}}
            onRandomize={handleRandomizePersonaClient}
            onReset={handleResetPersona}
            stepStatus={getStepStatus("persona")}
            stepTitle={steps[1]?.title || ""}
            stepDescription={steps[1]?.description || ""}
            stepNumber={2}
            isReadonly={isReadonly}
            disabled={isPending}
            isRandomizing={
              randomizingSection === "persona" || randomizingSection === "all"
            }
            isEditMode={isEditMode}
          />
        )}

      {/* Step 3: Documents */}
      <DocumentSection
        validDocumentIds={videoData?.valid_document_ids || []}
        documentMapping={documentMapping}
        selectedDocumentIds={selectedDocumentIds}
        templateDocumentIds={templateDocumentIds}
        {...(videoData &&
        "document_details" in videoData &&
        videoData.document_details
          ? {
              documentDetails: videoData.document_details as Array<{
                document_id: string;
                upload_id?: string | null;
                [key: string]: unknown;
              }>,
            }
          : {})}
        searchTerm={documentSearchTerm}
        minMax={documentMinMax}
        previewDocumentId={previewDocumentId}
        onDocumentIdsChange={setSelectedDocumentIds}
        onTemplateDocumentIdsChange={setTemplateDocumentIds}
        onSearchTermChange={setDocumentSearchTerm}
        onMinMaxChange={setDocumentMinMax}
        onPreviewDocument={setPreviewDocumentId}
        onRandomize={handleRandomizeDocumentsClient}
        onReset={handleResetDocuments}
        stepStatus={getStepStatus("documents")}
        stepTitle={steps[2]?.title || ""}
        stepDescription={steps[2]?.description || ""}
        stepNumber={3}
        isReadonly={isReadonly}
        isRandomizing={
          randomizingSection === "document" || randomizingSection === "all"
        }
        isEditMode={isEditMode}
      />

      {/* Step 4: Parameters */}
      <ParameterSection
        validParameterIds={videoData?.valid_parameter_ids || []}
        parameterMapping={parameterMapping}
        selectedParameterIds={formData.parameterIds || []}
        searchTerm={parameterSearchTerm}
        minMax={
          videoData?.allowed_ranges?.parameter_selection || { min: 0, max: 3 }
        }
        onParameterIdsChange={(ids) => handleInputChange("parameterIds", ids)}
        onSearchTermChange={setParameterSearchTerm}
        onMinMaxChange={() => {}}
        onRandomize={handleRandomizeParametersClient}
        onParameterUnselect={(paramId) => {
          // When unselecting a parameter, also remove all its fields
          setCurrentFieldIds((prev) =>
            prev.filter(
              (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
            )
          );
        }}
        onReset={handleResetParameters}
        stepStatus={getStepStatus("parameters")}
        stepTitle={steps[3]?.title || ""}
        stepDescription={steps[3]?.description || ""}
        stepNumber={4}
        isReadonly={isReadonly}
        isRandomizing={
          randomizingSection === "parameters" || randomizingSection === "all"
        }
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
          const selectedItemsForParam = currentFieldIds.filter(
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
              minMax={
                fieldMinMax[paramId] ||
                videoData?.allowed_ranges?.fields?.[paramId] || {
                  min: 1,
                  max: 3,
                }
              }
              allowedRange={
                videoData?.allowed_ranges?.fields?.[paramId]
                  ? {
                      min: videoData.allowed_ranges.fields[paramId].min,
                      max: videoData.allowed_ranges.fields[paramId].max,
                    }
                  : undefined
              }
              onFieldIdsChange={(newIds) => {
                // Update only this parameter's fields
                const otherFieldIds = currentFieldIds.filter(
                  (itemId) => fieldMapping[itemId]?.parameter_id !== paramId
                );
                setCurrentFieldIds([...otherFieldIds, ...newIds]);
              }}
              onMinMaxChange={(minMax) =>
                setFieldMinMax((prev) => ({
                  ...prev,
                  [paramId]: minMax,
                }))
              }
              onRandomize={() => handleRandomizeParameterClient(paramId)}
              onReset={() => handleResetParameter(paramId)}
              stepStatus={stepStatus}
              stepNumber={stepIndex + 1}
              isReadonly={isReadonly}
              isRandomizing={
                randomizingSection === `parameter_${paramId}` ||
                randomizingSection === "all"
              }
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
        {...(videoData &&
        "document_details" in videoData &&
        videoData.document_details
          ? {
              documentDetails: videoData.document_details as Array<{
                document_id: string;
                upload_id?: string | null;
                [key: string]: unknown;
              }>,
            }
          : {})}
        templateDocumentIds={templateDocumentIds}
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
