/**
 * Video.tsx
 * Video creation and editing component with interactive question timeline
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import {
  Check,
  ChevronsUpDown,
  HelpCircle,
  Image,
  Loader2,
  Plus,
  Power,
  RotateCcw,
  Shuffle,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as tus from "tus-js-client";

// UI Components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Custom Components
import { AgentPicker } from "@/components/common/forms/AgentPicker";
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import { ImagePreviewCard } from "@/components/common/forms/ImagePreviewCard";
import {
  DocumentMappingItem,
  DocumentPicker,
} from "@/components/common/forms/DocumentPicker";
import { PersonaPicker } from "@/components/common/forms/PersonaPicker";
import { ParameterSelector } from "@/components/parameters/ParameterSelector";
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

type ParameterItemMappingItem = {
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
  value: string; // ParameterSelector expects string
};

type ParameterMapping = Record<string, ParameterMappingItem>;
type ParameterItemMapping = Record<string, ParameterItemMappingItem>;

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
    problemStatementIds?: string[];
    objectiveIds?: string[];
    policyIds?: string[];
    targets: string[];
  };
};

type RandomizeVideoOut = {
  success: boolean;
  message: string;
  problemStatementIds: string[];
  objectiveIds: string[];
  policyIds: string[];
};

type StepStatus = "pending" | "active" | "completed";

interface Step {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  optional?: boolean;
}

const VIDEO_LENGTHS = [
  { value: 4, label: "4 seconds" },
  { value: 8, label: "8 seconds" },
  { value: 12, label: "12 seconds" },
  { value: 16, label: "16 seconds" },
  { value: 20, label: "20 seconds" },
  { value: 24, label: "24 seconds" },
  { value: 28, label: "28 seconds" },
  { value: 32, label: "32 seconds" },
];

interface VideoLengthPickerProps {
  value: number;
  onValueChange: (value: number) => void;
  disabled?: boolean;
}

function VideoLengthPicker({
  value,
  onValueChange,
  disabled = false,
}: VideoLengthPickerProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    VIDEO_LENGTHS.find((vl) => vl.value === value)?.label || "Select length";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select video length"
          size="sm"
          className={cn("w-[140px] justify-between", disabled && "opacity-50")}
          disabled={disabled}
        >
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronsUpDown className="opacity-50 flex-shrink-0 ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command>
          <CommandList>
            <CommandEmpty>No length found.</CommandEmpty>
            <CommandGroup>
              {VIDEO_LENGTHS.map((vl) => (
                <CommandItem
                  key={vl.value}
                  onSelect={() => {
                    onValueChange(vl.value);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  {vl.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === vl.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function Video({
  mode = "create",
  videoId,
  videoDetail: serverVideoDetail,
  videoDetailDefault: serverVideoDetailDefault,
  createVideoAction,
  updateVideoAction,
  randomizeVideoAction,
  generateOutlineAction,
  generateVideoAction,
}: VideoProps) {
  const router = useRouter();
  const { effectiveProfile, socket, isConnected } = useProfile();
  const { setEntityMetadata, clearEntityMetadata } = useBreadcrumbContext();
  const isEditMode = mode === "edit" && !!videoId;
  const isSuperadmin = effectiveProfile?.role === "superadmin";

  // Use server-provided data directly
  const videoDetail = serverVideoDetail;
  const videoDetailDefault = serverVideoDetailDefault;

  // Use edit detail when editing, default detail when creating
  const videoData = isEditMode ? videoDetail : videoDetailDefault;

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
    const videoLength =
      formData.length_seconds > 0 ? formData.length_seconds : 4;

    const createPayload: CreateVideoBody = {
      name: videoName,
      length_seconds: videoLength,
      department_ids: finalDepartmentIds,
      active: formData.active ?? true,
      questions: questionsForApi,
      personaIds: formData.personaIds || [],
    };

    if (outlineIds.length > 0) {
      createPayload.outline_ids = outlineIds;
    }
    if (selectedDocumentIds.length > 0) {
      createPayload.document_ids = selectedDocumentIds;
    }
    if (uploadIds.length > 0) {
      (createPayload as any).upload_ids = uploadIds;
      (createPayload as any).image_names = imageNames;
    }
    if (currentParameterItemIds.length > 0) {
      (createPayload as any).parameter_item_ids = currentParameterItemIds;
    }
    // Note: outline_agent_id is not supported in create endpoint
    // It will be set via update after creation if needed

    return createPayload as any;
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

      // For policies randomization, don't send policyIds to force randomization (like documents in Scenario.tsx)
      // The backend will randomize if policyIds is not provided
      if (section === "policies") {
        // Don't set body.policyIds - let backend randomize
      }

      // For parameters randomization, we handle it client-side
      if (section === "parameters") {
        // Client-side randomization for general video parameters
      }

      const result = await randomizeVideoAction({ body });

      if (result.success) {
        // Update policies if randomized
        if (targets.includes("policies") && result.policyIds.length > 0) {
          setSelectedDocumentIds(result.documentIds);

          // Randomize policy parameters for the new policies (client-side)
          // Filter available policy parameter items for the new policies
          const newDocumentParameterItemIds: string[] = [];
          documentParameterIds.forEach((paramId) => {
            const paramItems = Object.entries(parameterItemMapping)
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
          const nonDocumentParamIds = currentParameterItemIds.filter((itemId) => {
            const item = parameterItemMapping[itemId];
            if (!item) return true;
            const paramId = item.parameter_id;
            return !documentParameterIds.includes(paramId);
          });
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
            const paramItems = Object.entries(parameterItemMapping)
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
            const item = parameterItemMapping[itemId];
            if (!item) return false;
            const paramId = item.parameter_id;
            return policyParameterIds.includes(paramId);
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

  const handleGenerateOutline = async () => {
    if (!socket || !isConnected || !effectiveProfile?.id) {
      toast.error("WebSocket not connected");
      return;
    }

    if (selectedDocumentIds.length === 0) {
      toast.error("Please select a policy");
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

    setIsGeneratingOutline(true);
    try {
      const body: GenerateOutlineIn["body"] = {
        departmentId,
        documentIds: selectedDocumentIds,
        questionIds: null, // Questions are now generated by outline agent if useQuestions is true
        // @ts-expect-error - parameterItemIds will be added to schema in next regeneration
        parameterItemIds:
          currentParameterItemIds.length > 0
            ? currentParameterItemIds
            : undefined,
        profileId: effectiveProfile.id,
        videoLengthSeconds: outlineVideoLength,
        useQuestions: useQuestions,
        // @ts-expect-error - existingQuestions will be added to schema in next regeneration
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
        // @ts-expect-error - personaIds will be added to schema in next regeneration
        personaIds: formData.personaIds && formData.personaIds.length > 0 ? formData.personaIds : undefined,
      };

      if (isEditMode && videoId) {
        body.videoId = videoId;
      }

      const result = await new Promise<GenerateOutlineOut>((resolve, reject) => {
        const handleProgress = (data: {
          type: string;
          message?: string;
          trace_id?: string;
        }) => {
          if (data.type === "start") {
            toast.info(data.message || "Starting outline generation...");
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
          socket.off("video_outline_generation_progress", handleProgress);
          socket.off("video_outline_generation_complete", handleComplete);
          socket.off("video_outline_generation_error", handleError);

          if (data.success) {
            resolve({
              success: true,
              message: data.message,
              name: data.name,
              outline: data.outline,
              outline_id: data.outline_id || null,
              video_name: data.video_name || null,
              questions: data.questions || null,
              question_timestamps: data.question_timestamps || null,
            });
          } else {
            reject(new Error(data.message || "Outline generation failed"));
          }
        };

        const handleError = (data: {
          success: boolean;
          message: string;
          trace_id?: string;
        }) => {
          socket.off("video_outline_generation_progress", handleProgress);
          socket.off("video_outline_generation_complete", handleComplete);
          socket.off("video_outline_generation_error", handleError);

          reject(new Error(data.message || "Outline generation failed"));
        };

        socket.on("video_outline_generation_progress", handleProgress);
        socket.on("video_outline_generation_complete", handleComplete);
        socket.on("video_outline_generation_error", handleError);

        socket.emit("generate_video_outline", {
          departmentId: body.departmentId,
          documentIds: body.documentIds,
          questionIds: body.questionIds,
          parameterItemIds: body.parameterItemIds,
          existingQuestions: body.existingQuestions,
          profileId: body.profileId,
          videoId: body.videoId,
          videoLengthSeconds: body.videoLengthSeconds,
          useQuestions: body.useQuestions,
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
        // Update questions from response (only if useQuestions was true)
        if (useQuestions && result.questions && result.questions.length > 0) {
          const convertedQuestions: Question[] = result.questions.map(
            (q, _index) => ({
              question_text: q.question_text,
              allow_multiple: q.allow_multiple,
              times: [], // Will be set from question_timestamps
              options: q.options.map((opt) => ({
                option_text: opt.option_text,
                type: opt.type as "discrete" | "freeform",
                is_correct: opt.is_correct,
              })),
            })
          );
          setQuestions(convertedQuestions);
        }
        // Update question timestamps directly from response (only if useQuestions was true)
        if (useQuestions && result.question_timestamps && result.questions) {
          // Map question IDs (1, 2, 3) to questions array indices
          const questionIdToIndex: Record<string, number> = {};
          result.questions.forEach((_, _index) => {
            questionIdToIndex[String(_index + 1)] = _index;
          });
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

        toast.success(
          useQuestions
            ? "Outline and questions generated successfully!"
            : "Outline generated successfully!"
        );
      }
    } catch (error) {
      toast.error(
        `Failed to generate outline: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGeneratingOutline(false);
    }
  };

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

    setIsGeneratingVideo(true);

    try {
      // Use first image if available (backend expects single image reference)
      const imageId = images.length > 0 && images[0] ? images[0].id : null;

      const body: GenerateVideoIn["body"] = {
        videoId: videoId,
        prompt: outlineText,
        imageReferenceId: imageId ?? null,
      };

      const result = await new Promise<GenerateVideoOut>((resolve, reject) => {
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
            toast.info(`Video generation: ${progressMsg}`, { id: "video-progress" });
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
            resolve({
              success: true,
              message: data.message,
              videoUrl: data.videoUrl || null,
              videoId: data.videoId || null,
            });
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

        socket.emit("generate_video", {
          videoId: body.videoId,
          prompt: body.prompt,
          imageReferenceId: body.imageReferenceId,
        });
      });

      if (result.success && result.videoUrl) {
        setGeneratedVideoUrl(result.videoUrl);
        // Clear uploaded video when generated video replaces it
        setUploadedVideoFile(null);
        setVideoObjectUrl(null);
        toast.success("Video generated successfully!");
      } else {
        toast.info(result.message || "Video generation completed");
      }
    } catch (error) {
      toast.error(
        `Failed to generate video: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleResetSection = (section: string) => {
    if (section === "policies") {
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Calculate max images allowed: video length / 4 + 1
    const maxImages = Math.floor(outlineVideoLength / 4) + 1;
    const currentImageCount = images.length;
    const remainingSlots = maxImages - currentImageCount;

    if (remainingSlots <= 0) {
      toast.error(
        `Maximum ${maxImages} image${maxImages !== 1 ? "s" : ""} allowed for a ${outlineVideoLength}-second video`
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
            const updateResult = await updateVideoAction({
              body: {
                videoId: videoId,
                name: currentVideo.name,
                length_seconds: currentVideo.length_seconds,
                upload_id: databaseUploadId,
                department_ids: currentVideo.department_ids || [],
                outline_ids: currentVideo.outline_ids || [],
                document_ids: currentVideo.document_ids || [],
                image_ids: currentVideo.image_ids || [],
                active: currentVideo.active,
                questions: currentVideo.questions || [],
                outline_agent_id: currentVideo.outline_agent_id || null,
                image_agent_id: currentVideo.image_agent_id || null,
                parameter_item_ids: currentVideo.parameter_item_ids || [],
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
    problemStatement: string;
    active: boolean;
    outlineAgentId: string | null;
    personaIds: string[];
  };

  // Outline state
  const [selectedOutlineId, setSelectedOutlineId] = useState<string | null>(
    null
  );
  const [outlineText, setOutlineText] = useState<string>("");
  const [outlineVideoLength, setOutlineVideoLength] = useState<number>(4);
  const [useImage, setUseImage] = useState(false);
  const [useQuestions, setUseQuestions] = useState(true);
  const [images, setImages] = useState<
    Array<{
      id: string;
      name: string;
      mime_type: string;
    }>
  >([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Policies state
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
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
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
      personaIds: [],
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

  // Policy mapping
  const documentMapping = useMemo(() => {
    // Server returns dict[str, dict[str, str]] which matches DocumentMappingItem structure
    // Use double assertion to handle index signature compatibility
    return (videoData?.document_mapping || {}) as unknown as Record<
      string,
      DocumentMappingItem
    >;
  }, [videoData?.document_mapping]);

  // Parameter mapping (filtered by video_parameter = true OR document_parameter = true)
  const parameterMapping = useMemo((): ParameterMapping => {
    const mapping = ((videoData as any)?.parameter_mapping || {}) as Record<
      string,
      any
    >;
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
      Object.entries(filtered).map(([key, param]: [string, any]) => [
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
  }, [(videoData as any)?.parameter_mapping]);

  // Parameter item mapping
  const parameterItemMapping = useMemo((): ParameterItemMapping => {
    const mapping = ((videoData as any)?.parameter_item_mapping ||
      {}) as Record<string, any>;
    // Convert to ParameterItemMapping format with proper value type (must be string for ParameterSelector)
    return Object.fromEntries(
      Object.entries(mapping).map(([key, item]: [string, any]) => [
        key,
        {
          name: item?.name || "",
          description: item?.description || "",
          parameter_id: item?.parameter_id || "",
          parameter_name: item?.parameter_name || "",
          value: item?.value !== undefined ? String(item.value) : "",
        },
      ])
    ) as ParameterItemMapping;
  }, [(videoData as any)?.parameter_item_mapping]);

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
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, parameterItemMapping, documentParameterIds]);

  const generalVideoParameterItemIds = useMemo(() => {
    return currentParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalVideoParameterIds.includes(paramId);
    });
  }, [currentParameterItemIds, parameterItemMapping, generalVideoParameterIds]);

  // Filter valid parameter item IDs by parameter type
  const validParameterItemIds = useMemo(() => {
    // Get all parameter item IDs from mapping that belong to video parameters
    const allVideoParamItemIds = Object.keys(parameterItemMapping).filter(
      (itemId) => {
        const item = parameterItemMapping[itemId];
        if (!item) return false;
        const paramId = item.parameter_id;
        return Object.keys(parameterMapping).includes(paramId);
      }
    );
    return allVideoParamItemIds;
  }, [parameterItemMapping, parameterMapping]);

  const validDocumentParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return documentParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, parameterItemMapping, documentParameterIds]);

  const validGeneralVideoParameterItemIds = useMemo(() => {
    return validParameterItemIds.filter((itemId) => {
      const item = parameterItemMapping[itemId];
      if (!item) return false;
      const paramId = item.parameter_id;
      return generalVideoParameterIds.includes(paramId);
    });
  }, [validParameterItemIds, parameterItemMapping, generalVideoParameterIds]);

  // Build parameter mappings filtered by type
  const documentParameterMapping = useMemo(() => {
    return Object.fromEntries(
      Object.entries(parameterMapping).filter(([paramId]) =>
        documentParameterIds.includes(paramId)
      )
    );
  }, [parameterMapping, documentParameterIds]);

  const generalVideoParameterMapping = useMemo(() => {
    return Object.fromEntries(
      Object.entries(parameterMapping).filter(([paramId]) =>
        generalVideoParameterIds.includes(paramId)
      )
    );
  }, [parameterMapping, generalVideoParameterIds]);

  // Outline mapping (for version history) - only exists in VideoDetailOut, not VideoNewOut
  const outlineMapping = useMemo(() => {
    if (isEditMode && videoDetail) {
      return videoDetail.outline_mapping || {};
    }
    return {};
  }, [isEditMode, videoDetail]);

  // Load video data from server response
  useEffect(() => {
    if (videoData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing video data (only once)
      const deptIds = videoData.department_ids || [];

      setFormData({
        name: videoData.name,
        length_seconds: videoData.length_seconds,
        departmentIds: deptIds,
        problemStatement: "", // Not used anymore, kept for form compatibility
        active: videoData.active ?? true,
        outlineAgentId: videoData.outline_agent_id || null,
        personaIds: videoData.persona_ids || [],
      });

      // Load parameter items
      if ((videoData as any)?.parameter_item_ids) {
        setCurrentParameterItemIds((videoData as any).parameter_item_ids);
      }

      // Initialize outline video length from video data
      setOutlineVideoLength(videoData.length_seconds || 4);

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
          .map((img: any) => {
            const uploadId = img.upload_id || img.id;
            return {
              id: uploadId, // Use upload_id as id
              name: img.name || "",
              mime_type: img.mime_type || "image/png",
              upload_id: uploadId,
              file_path: `/api/v3/uploads/download/${uploadId}`, // Use upload download endpoint
            };
          })
          .filter((img: { id?: string }) => img.id);
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

      // Load video URL if video file exists - construct from videoId (like documents)
      if (isEditMode && videoId && videoDetail?.file_path) {
        setGeneratedVideoUrl(`/api/videos/download/${videoId}`);
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

    // Find first available outline agent
    const outlineAgentIds = videoData.valid_agent_ids.filter((id) => {
      const agent = agentMapping[id];
      return agent?.["roles"]?.includes("outline");
    });

    // Only update if we have agents and they're not already set
    const updates: Partial<FormData> = {};

    if (outlineAgentIds.length > 0 && !formData.outlineAgentId) {
      updates.outlineAgentId = outlineAgentIds[0]!;
    }

    if (Object.keys(updates).length > 0) {
      setFormData((prev) => ({ ...prev, ...updates }));
    }
  }, [
    videoData?.valid_agent_ids,
    agentMapping,
    isEditMode,
    formData.outlineAgentId,
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
          length_seconds: formData.length_seconds || 4, // Default to 4 seconds
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
          personaIds: formData.personaIds || [],
        };

        if (outlineIds.length > 0) {
          updatePayload.outline_ids = outlineIds;
        }
        if (selectedDocumentIds.length > 0) {
          updatePayload.document_ids = selectedDocumentIds;
        }
        if (uploadIds.length > 0) {
          (updatePayload as any).upload_ids = uploadIds;
          (updatePayload as any).image_names = imageNames;
        }
        if (formData.outlineAgentId) {
          updatePayload.outline_agent_id = formData.outlineAgentId;
        }
        if (currentParameterItemIds.length > 0) {
          (updatePayload as any).parameter_item_ids = currentParameterItemIds;
        }

        await handleUpdateVideo(updatePayload as any);
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
      case "policies":
        // Can start immediately, doesn't depend on name
        return selectedDocumentIds.length > 0 ? "completed" : "active";
      case "parameters":
        // Active when policies are selected, completed when parameter items are selected
        return selectedDocumentIds.length === 0
          ? "pending"
          : currentParameterItemIds.length > 0
            ? "completed"
            : "active";
      case "outline":
        // Active if policies are selected (questions are generated with outline)
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
              (isEditMode && videoDetail?.file_path)
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
      id: "policies",
      title: "Policies",
      description: "Select policies that will be available for this video",
      status: getStepStatus("policies"),
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
        "Generate video outline from policies (questions are generated automatically)",
      status: getStepStatus("outline"),
    },
    {
      id: "video_generation",
      title: "Video Generation",
      description: "Generate video using AI or upload a video file",
      status: getStepStatus("video_generation"),
    },
  ];

  // Question modal state
  const [showMCQModal, setShowMCQModal] = useState(false);
  const [editingMCQQuestion, setEditingMCQQuestion] = useState<Question | null>(
    null
  );

  // Timeline segment modal state
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [selectedTimelineSegment, setSelectedTimelineSegment] = useState<
    number | null
  >(null);
  const [selectedQuestionsForSegment, setSelectedQuestionsForSegment] =
    useState<string[]>([]);

  const openMCQModal = (time?: number, question?: Question) => {
    if (question) {
      // Ensure minimum 2 options when editing existing question
      const options =
        question.options.length >= 2
          ? question.options
          : [
              ...question.options,
              ...Array.from({ length: 2 - question.options.length }, () => ({
                option_text: "",
                type: "discrete" as const,
                is_correct: false,
              })),
            ];
      setEditingMCQQuestion({ ...question, options });
    } else {
      setEditingMCQQuestion({
        question_text: "",
        allow_multiple: false,
        times: time !== undefined ? [time] : [],
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
      });
    }
    setShowMCQModal(true);
  };

  const closeMCQModal = () => {
    setShowMCQModal(false);
    setEditingMCQQuestion(null);
  };

  const saveMCQQuestion = () => {
    if (!editingMCQQuestion) return;

    if (!editingMCQQuestion.question_text.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (editingMCQQuestion.options.length < 2) {
      toast.error("Choice questions must have at least 2 options");
      return;
    }

    // Allow questions without times when adding manually (not from timeline)
    // Set default time to 0 if no time specified
    if (editingMCQQuestion.times.length === 0) {
      editingMCQQuestion.times = [0];
    }

    // Infer allow_multiple from number of correct answers
    const correctCount = editingMCQQuestion.options.filter(
      (opt) => opt.is_correct
    ).length;
    const updatedQuestion = {
      ...editingMCQQuestion,
      allow_multiple: correctCount > 1,
    };

    if (correctCount === 0) {
      toast.error("Choice questions must have at least one correct answer");
      return;
    }

    if (updatedQuestion.question_id) {
      // Update existing question
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === updatedQuestion.question_id ? updatedQuestion : q
        )
      );
    } else {
      // Add new question - check max limit
      const maxQuestions = Math.floor(outlineVideoLength / 4) + 1;
      if (questions.length >= maxQuestions) {
        toast.error(
          `Maximum ${maxQuestions} question${maxQuestions !== 1 ? "s" : ""} allowed for a ${outlineVideoLength}-second video`
        );
        return;
      }
      setQuestions((prev) => [...prev, updatedQuestion]);
    }

    closeMCQModal();
  };

  const deleteQuestion = (questionId?: string) => {
    if (!questionId) return;
    setQuestions((prev) => prev.filter((q) => q.question_id !== questionId));
  };

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Get all question times for timeline markers
  const allQuestionTimes = useMemo(() => {
    const times = new Set<number>();
    questions.forEach((q) => {
      q.times.forEach((t) => times.add(t));
    });
    return Array.from(times).sort((a, b) => a - b);
  }, [questions]);

  // Video upload state (placeholder for now)
  const [isDragActive, setIsDragActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
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

  return (
    <div className="space-y-6 py-4 px-4">
      {/* Step 1: Basic Information - Subtle inline name editor */}
      <Card className="transition-all">
        <CardContent className="pt-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <input
                type="text"
                data-testid="input-video-name"
                value={formData.name || ""}
                onChange={(e) => handleInputChange("name", e.target.value)}
                onFocus={(e) => {
                  if (e.target.value === "New Video") {
                    e.target.select();
                  }
                }}
                onBlur={(e) => {
                  // If empty on blur, revert to "New Video"
                  if (!e.target.value || e.target.value.trim() === "") {
                    handleInputChange("name", "New Video");
                  }
                }}
                className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
                placeholder="New Video"
                disabled={isReadonly}
              />
              <p className="text-xs text-muted-foreground mt-1 px-2">
                {formData.name === "New Video" || !formData.name
                  ? "Click to edit • Name will be auto-generated if unchanged"
                  : "Click to edit"}
              </p>
              {errors["name"] && (
                <p className="text-sm text-destructive px-2 mt-1">
                  {errors["name"]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardContent className="pt-0 space-y-4">
          {/* Department Selection */}
          {videoData?.valid_department_ids &&
            videoData.valid_department_ids.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                {formData?.departmentIds !== undefined ? (
                  <DepartmentPicker
                    mapping={departmentMapping}
                    validIds={Array.from(
                      new Set([
                        ...(videoData?.valid_department_ids || []),
                        ...(formData.departmentIds || []),
                      ])
                    )}
                    selectedIds={formData.departmentIds || []}
                    onSelect={(ids) => handleInputChange("departmentIds", ids)}
                    placeholder="All Departments"
                    disabled={isReadonly}
                    multiSelect={true}
                  />
                ) : null}
              </div>
            )}

          {/* Personas */}
          {videoData?.persona_ids && videoData.persona_ids.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="personas">Personas</Label>
              {formData?.personaIds !== undefined ? (
                <PersonaPicker
                  mapping={personaMapping}
                  validIds={videoData.persona_ids}
                  selectedIds={formData.personaIds || []}
                  onSelect={(ids) => handleInputChange("personaIds", ids)}
                  placeholder="Select personas"
                  disabled={isReadonly}
                  multiSelect={true}
                />
              ) : null}
            </div>
          )}

          {/* Agent Selection */}
          {(() => {
            const outlineAgentIds =
              videoData?.valid_agent_ids?.filter((id) => {
                const agent = agentMapping[id];
                return agent?.["roles"]?.includes("outline");
              }) || [];

            // Only show agent picker if there's more than one option
            const showOutlinePicker = outlineAgentIds.length > 1;

            if (!showOutlinePicker) {
              return null;
            }

            return (
              <div className="space-y-2">
                <Label htmlFor="outlineAgentId">Outline Agent</Label>
                {formData?.outlineAgentId !== undefined ? (
                  <AgentPicker
                    mapping={agentMapping as Record<string, AgentMappingItem>}
                    validIds={outlineAgentIds}
                    selectedIds={
                      formData?.outlineAgentId ? [formData.outlineAgentId] : []
                    }
                    onSelect={(ids) =>
                      setFormData((prev) => ({
                        ...prev,
                        outlineAgentId: ids[0] || null,
                      }))
                    }
                    placeholder="Select outline agent"
                    disabled={isReadonly}
                    multiSelect={false}
                  />
                ) : null}
              </div>
            );
          })()}

          {/* Active Switch */}
          <div className="space-y-2 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="active"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Power className="h-3.5 w-3.5 text-muted-foreground" />
                  Active
                </Label>
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) =>
                    handleInputChange("active", checked)
                  }
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Inactive videos will not be available for use
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Policies */}
      <Card
        className={`transition-all ${!isEditMode && getStepStatus("policies") === "active" ? "ring-2 ring-primary" : ""} ${
          !isEditMode && getStepStatus("policies") === "pending"
            ? "opacity-50"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                getStepStatus("policies") === "completed"
                  ? "bg-green-500 text-white"
                  : getStepStatus("policies") === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {getStepStatus("policies") === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                "2"
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{steps[1]?.title || ""}</CardTitle>
              <CardDescription>{steps[1]?.description || ""}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRandomizeVideo(["policies"], "policies")}
                  disabled={isRandomizing || isReadonly}
                >
                  {isRandomizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Randomize</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleResetSection("policies")}
                  disabled={isReadonly}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocumentPicker
            mapping={documentMapping}
            validIds={videoData?.valid_document_ids || []}
            selectedIds={selectedDocumentIds}
            documentDetails={[]}
            onSelect={(ids) => {
              setSelectedDocumentIds(ids);
            }}
            multiSelect={true}
            label="Documents"
            placeholder="Select documents..."
            description="Choose documents (policies) that will be available for this video."
            disabled={isSubmitting}
            readonly={isReadonly}
          />
          {/* Document Parameters - co-located with documents section */}
          {Object.keys(documentParameterMapping).length > 0 && (
            <div className="pt-2">
              <ParameterSelector
                parameterMapping={documentParameterMapping}
                parameterItemMapping={parameterItemMapping}
                validParameterItemIds={validDocumentParameterItemIds}
                selectedParameterItemIds={documentParameterItemIds}
                onParameterItemIdsChange={(newIds) => {
                  // Remove old document parameter items
                  const nonDocumentParamIds = currentParameterItemIds.filter(
                    (itemId) => {
                      const item = parameterItemMapping[itemId];
                      if (!item) return true;
                      const paramId = item.parameter_id;
                      return !documentParameterIds.includes(paramId);
                    }
                  );
                  // Combine with new document parameter items
                  const updatedParameterItemIds = [
                    ...nonDocumentParamIds,
                    ...newIds,
                  ];
                  setCurrentParameterItemIds(updatedParameterItemIds);
                }}
                disabled={isReadonly}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 3: Parameters */}
      <Card
        className={`transition-all ${!isEditMode && getStepStatus("parameters") === "active" ? "ring-2 ring-primary" : ""} ${
          !isEditMode && getStepStatus("parameters") === "pending"
            ? "opacity-50"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                getStepStatus("parameters") === "completed"
                  ? "bg-green-500 text-white"
                  : getStepStatus("parameters") === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {getStepStatus("parameters") === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                "3"
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{steps[2]?.title || ""}</CardTitle>
              <CardDescription>{steps[2]?.description || ""}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    handleRandomizeVideo(["parameters"], "parameters")
                  }
                  disabled={isRandomizing || isReadonly}
                >
                  {isRandomizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Randomize</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setCurrentParameterItemIds([]);
                  }}
                  disabled={isReadonly}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(generalVideoParameterMapping).length > 0 ? (
            <ParameterSelector
              parameterMapping={generalVideoParameterMapping as any}
              parameterItemMapping={parameterItemMapping as any}
              validParameterItemIds={validGeneralVideoParameterItemIds}
              selectedParameterItemIds={generalVideoParameterItemIds}
              onParameterItemIdsChange={(newIds) => {
                // Remove old general video parameter items
                const nonGeneralParamIds = currentParameterItemIds.filter(
                  (itemId) => {
                    const item = parameterItemMapping[itemId];
                    if (!item) return true;
                    const paramId = item.parameter_id;
                    return !generalVideoParameterIds.includes(paramId);
                  }
                );
                // Combine with new general video parameter items
                const updatedParameterItemIds = [
                  ...nonGeneralParamIds,
                  ...newIds,
                ];
                setCurrentParameterItemIds(updatedParameterItemIds);
              }}
              disabled={isReadonly}
            />
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No video parameters available. Parameters will appear here once
              they are configured.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Step 4: Outline */}
      <Card
        className={`transition-all ${!isEditMode && getStepStatus("outline") === "active" ? "ring-2 ring-primary" : ""} ${
          !isEditMode && getStepStatus("outline") === "pending"
            ? "opacity-50"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                getStepStatus("outline") === "completed"
                  ? "bg-green-500 text-white"
                  : getStepStatus("outline") === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {getStepStatus("outline") === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                "4"
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">{steps[3]?.title || ""}</CardTitle>
              <CardDescription>{steps[3]?.description || ""}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <VideoLengthPicker
              value={outlineVideoLength}
              onValueChange={(value) => {
                setOutlineVideoLength(value);
                // Update formData length_seconds as well
                handleInputChange("length_seconds", value);
              }}
              disabled={isReadonly}
            />
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateOutline}
              disabled={isSubmitting || isGeneratingOutline || isReadonly}
            >
              {isGeneratingOutline ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedOutlineId(null);
                    setOutlineText("");
                    setImages([]);
                    setUseImage(false);
                  }}
                  disabled={isReadonly}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image Preview or Upload Card */}
          {useImage && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label>Images</Label>
                <p className="text-xs text-muted-foreground">
                  Max {Math.floor(outlineVideoLength / 4) + 1} image
                  {Math.floor(outlineVideoLength / 4) + 1 !== 1 ? "s" : ""} (
                  {images.length}/{Math.floor(outlineVideoLength / 4) + 1})
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((img, index) => (
                  <ImagePreviewCard
                    key={img.id}
                    image={img}
                    onRemove={() => {
                      setImages((prev) => prev.filter((_, i) => i !== index));
                    }}
                    showActions={!isReadonly}
                  />
                ))}
                {images.length < Math.floor(outlineVideoLength / 4) + 1 && (
                  <div
                    onClick={() => {
                      if (!isReadonly && !isUploadingImage) {
                        imageInputRef.current?.click();
                      }
                    }}
                    className="aspect-square border-2 border-dashed border-muted-foreground/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-muted-foreground hover:bg-muted/50 transition-colors bg-muted/20"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Click to upload image
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={isReadonly || isUploadingImage}
                className="hidden"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Outline</Label>
            <Textarea
              value={outlineText || ""}
              onChange={(e) => {
                setOutlineText(e.target.value);
                if (selectedOutlineId) {
                  setSelectedOutlineId(null);
                }
              }}
              placeholder="Enter video outline or generate one from policies and questions..."
              className="min-h-[120px]"
              disabled={isReadonly}
            />
          </div>

          {/* Use Image Switch */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="use-image"
                className="text-sm flex items-center gap-1.5"
              >
                <Image
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-label="Image icon"
                />
                Use Images
              </Label>
              <Switch
                id="use-image"
                checked={useImage}
                onCheckedChange={(checked) => {
                  setUseImage(checked);
                  if (!checked) {
                    setImages([]);
                  }
                }}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Use video reference images
            </p>
          </div>

          {/* Use Questions Switch */}
          <div className="space-y-1 pt-2">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="use-questions"
                className="text-sm flex items-center gap-1.5"
              >
                <HelpCircle
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-label="Question icon"
                />
                Generate Questions
              </Label>
              <Switch
                id="use-questions"
                checked={useQuestions}
                onCheckedChange={(checked) => {
                  setUseQuestions(checked);
                  if (!checked) {
                    // Clear generated questions when disabled
                    setQuestions([]);
                  }
                }}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Automatically generate questions when generating outline
            </p>
          </div>

          {/* Manual Question Addition */}
          {useQuestions && (
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>
                  Questions ({questions.length}/
                  {Math.floor(outlineVideoLength / 4) + 1})
                </Label>
              </div>
              {questions.length > 0 && (
                <div className="space-y-2">
                  {questions.map((question, index) => (
                    <div
                      key={question.question_id || index}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {question.question_text}
                          </p>
                          {question.options.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {question.options.map((opt, optIdx) => (
                                <div
                                  key={optIdx}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  {opt.is_correct && (
                                    <Check className="h-3 w-3 text-green-600" />
                                  )}
                                  <span
                                    className={
                                      opt.is_correct ? "font-semibold" : ""
                                    }
                                  >
                                    {opt.option_text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {question.times.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Times: {question.times.join(", ")}s
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              openMCQModal(undefined, question);
                            }}
                            disabled={isReadonly}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteQuestion(question.question_id)}
                            disabled={isReadonly}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const maxQuestions = Math.floor(outlineVideoLength / 4) + 1;
                    if (questions.length >= maxQuestions) {
                      toast.error(
                        `Maximum ${maxQuestions} question${maxQuestions !== 1 ? "s" : ""} allowed for a ${outlineVideoLength}-second video`
                      );
                      return;
                    }
                    openMCQModal();
                  }}
                  disabled={
                    isReadonly ||
                    questions.length >= Math.floor(outlineVideoLength / 4) + 1
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add MCQ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const maxQuestions = Math.floor(outlineVideoLength / 4) + 1;
                    if (questions.length >= maxQuestions) {
                      toast.error(
                        `Maximum ${maxQuestions} question${maxQuestions !== 1 ? "s" : ""} allowed for a ${outlineVideoLength}-second video`
                      );
                      return;
                    }
              </div>

              {/* Timeline */}
              {questions.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <Label>
                    Timeline ({outlineVideoLength} seconds) - Click to assign
                    questions
                  </Label>
                  <div className="relative w-full h-12 bg-gray-200 rounded-lg overflow-hidden">
                    {/* Timeline markers for questions */}
                    {allQuestionTimes.map((time) => {
                      const questionsAtTime = questions.filter((q) =>
                        q.times.includes(time)
                      );
                      return (
                        <Tooltip key={time}>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (isReadonly) return;
                                setSelectedTimelineSegment(time);
                                // Get currently selected questions for this timestamp
                                const currentQuestions = questions
                                  .filter((q) => q.times.includes(time))
                                  .map(
                                    (q, idx) => q.question_id || `temp-${idx}`
                                  );
                                setSelectedQuestionsForSegment(
                                  currentQuestions
                                );
                                setShowTimelineModal(true);
                              }}
                              className="absolute top-0 w-3 h-full bg-blue-600 hover:bg-blue-700 cursor-pointer z-10"
                              style={{
                                left: `${(time / outlineVideoLength) * 100}%`,
                              }}
                              disabled={isReadonly}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {formatTime(time)} - {questionsAtTime.length}{" "}
                              question
                              {questionsAtTime.length !== 1 ? "s" : ""}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                    {/* Clickable timeline */}
                    <div
                      className="absolute inset-0 cursor-pointer"
                      onClick={(e) => {
                        if (isReadonly) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        const clickedTime = percentage * outlineVideoLength;

                        // Find the closest timestamp based on video length
                        const possibleTimestamps = Array.from(
                          { length: outlineVideoLength + 1 },
                          (_, i) => i
                        );
                        const closestTimestamp = possibleTimestamps.reduce(
                          (prev, curr) =>
                            Math.abs(curr - clickedTime) <
                            Math.abs(prev - clickedTime)
                              ? curr
                              : prev
                        );

                        setSelectedTimelineSegment(closestTimestamp);
                        // Get currently selected questions for this timestamp
                        const currentQuestions = questions
                          .filter((q) => q.times.includes(closestTimestamp))
                          .map((q, idx) => q.question_id || `temp-${idx}`);
                        setSelectedQuestionsForSegment(currentQuestions);
                        setShowTimelineModal(true);
                      }}
                    />

                    {/* Time labels */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-gray-600">
                      <span>0:00</span>
                      <span>{formatTime(outlineVideoLength)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 5: Video Generation */}
      <Card
        className={`transition-all ${!isEditMode && getStepStatus("video_generation") === "active" ? "ring-2 ring-primary" : ""} ${
          !isEditMode && getStepStatus("video_generation") === "pending"
            ? "opacity-50"
            : ""
        }`}
      >
        <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                getStepStatus("video_generation") === "completed"
                  ? "bg-green-500 text-white"
                  : getStepStatus("video_generation") === "active"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
              }`}
            >
              {getStepStatus("video_generation") === "completed" ? (
                <Check className="w-4 h-4" />
              ) : (
                "5"
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg">Video</CardTitle>
              <CardDescription>{steps[4]?.description || ""}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleGenerateVideo}
              disabled={
                isSubmitting ||
                isGeneratingVideo ||
                isUploadingVideo ||
                isReadonly ||
                !outlineText.trim()
              }
            >
              {isGeneratingVideo ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setGeneratedVideoUrl(null);
                    setUploadedVideoFile(null);
                    setVideoObjectUrl(null);
                  }}
                  disabled={
                    isReadonly || (!generatedVideoUrl && !uploadedVideoFile)
                  }
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Display - Shows either generated, uploaded, or server video */}
          {isUploadingVideo ? (
            <div className="space-y-2">
              <Label>Video</Label>
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Uploading video...</p>
                </div>
              </div>
            </div>
          ) : generatedVideoUrl ||
            (isEditMode &&
              videoId &&
              videoDetail?.file_path &&
              !uploadedVideoFile) ? (
            <div className="space-y-2">
              <Label>Video</Label>
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <video
                  src={generatedVideoUrl || `/api/videos/download/${videoId}`}
                  controls
                  className="w-full h-full rounded-lg"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setGeneratedVideoUrl(null);
                    // If there's an uploaded video, it will show after clearing generated
                  }}
                  className="absolute top-2 right-2"
                  disabled={isReadonly || !!videoDetail?.file_path}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : uploadedVideoFile && videoObjectUrl ? (
            <div className="space-y-2">
              <Label>Video</Label>
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  src={videoObjectUrl}
                  controls
                  className="w-full h-full rounded-lg"
                  onLoadedMetadata={handleVideoLoadedMetadata}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveVideo}
                  className="absolute top-2 right-2"
                  disabled={isReadonly}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Video</Label>
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-16 text-center transition-colors cursor-pointer relative aspect-video flex items-center justify-center",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isReadonly && !isUploadingVideo) {
                    document.getElementById("video-upload-input")?.click();
                  }
                }}
              >
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={isReadonly || isUploadingVideo}
                  className="hidden"
                />
                <div className="space-y-3">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="text-lg font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Video files only
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Timeline Segment Modal */}
      {showTimelineModal && selectedTimelineSegment !== null && (
        <AlertDialog
          open={showTimelineModal}
          onOpenChange={setShowTimelineModal}
        >
          <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Select Questions for {formatTime(selectedTimelineSegment)}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions available. Please add questions first.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions
                    .map((q, idx) => {
                      const qKey = q.question_id || `temp-${idx}`;
                      // Check if question is already assigned to OTHER timestamps (not this one)
                      const isAssignedElsewhere = q.times.some(
                        (t) => t !== selectedTimelineSegment!
                      );
                      const isSelected =
                        selectedQuestionsForSegment.includes(qKey);

                      return { q, qKey, isAssignedElsewhere, isSelected, idx };
                    })
                    .filter(({ isAssignedElsewhere }) => !isAssignedElsewhere) // Hide questions assigned to other timestamps
                    .map(({ q, qKey, isSelected }) => (
                      <div
                        key={qKey}
                        className="flex items-start space-x-3 p-3 border rounded-lg"
                      >
                        <Checkbox
                          id={`timeline-${qKey}`}
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            if (isReadonly) return;
                            if (checked) {
                              setSelectedQuestionsForSegment([
                                ...selectedQuestionsForSegment,
                                qKey,
                              ]);
                            } else {
                              setSelectedQuestionsForSegment(
                                selectedQuestionsForSegment.filter(
                                  (k) => k !== qKey
                                )
                              );
                            }
                          }}
                          disabled={isReadonly}
                        />
                        <Label
                          htmlFor={`timeline-${qKey}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium">{q.question_text}</div>
                        </Label>
                      </div>
                    ))}
                  {questions.filter((q) => {
                    return q.times.some((t) => t !== selectedTimelineSegment!);
                  }).length === questions.length && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      All questions are already assigned to other timestamps.
                    </p>
                  )}
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setShowTimelineModal(false);
                  setSelectedTimelineSegment(null);
                  setSelectedQuestionsForSegment([]);
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (isReadonly) return;
                  const timestamp = selectedTimelineSegment!;

                  // Remove this timestamp from all questions
                  setQuestions((prev) =>
                    prev.map((q) => ({
                      ...q,
                      times: q.times.filter((t) => t !== timestamp),
                    }))
                  );

                  // Add this timestamp to selected questions
                  setQuestions((prev) =>
                    prev.map((q, idx) => {
                      const qKey = q.question_id || `temp-${idx}`;
                      if (selectedQuestionsForSegment.includes(qKey)) {
                        // Add the timestamp if not already present
                        const newTimes = [...q.times, timestamp]
                          .filter((t, i, arr) => arr.indexOf(t) === i)
                          .sort((a, b) => a - b);
                        return { ...q, times: newTimes };
                      }
                      return q;
                    })
                  );

                  setShowTimelineModal(false);
                  setSelectedTimelineSegment(null);
                  setSelectedQuestionsForSegment([]);
                }}
                disabled={isReadonly}
              >
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* MCQ Question Modal */}
      {showMCQModal && editingMCQQuestion && (
        <AlertDialog open={showMCQModal} onOpenChange={closeMCQModal}>
          <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {editingMCQQuestion.question_id
                  ? "Edit MCQ Question"
                  : "Add MCQ Question"}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Textarea
                  value={editingMCQQuestion.question_text}
                  onChange={(e) =>
                    setEditingMCQQuestion({
                      ...editingMCQQuestion,
                      question_text: e.target.value,
                    })
                  }
                  placeholder="Enter question text"
                  rows={3}
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <Label>Options *</Label>
                {editingMCQQuestion.options.length === 0 ? (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        if (!editingMCQQuestion) return;
                        setEditingMCQQuestion({
                          ...editingMCQQuestion,
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
                        });
                      }}
                      disabled={isReadonly}
                      size="sm"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Option
                    </Button>
                  </div>
                ) : (
                  <>
                    {editingMCQQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className={`flex items-end gap-2 ${index === 0 ? "" : ""}`}
                      >
                        {/* Option Text */}
                        <div
                          className={`flex-1 ${index === 0 ? "space-y-2" : ""}`}
                        >
                          {index === 0 && (
                            <Label
                              htmlFor={`option-text-${index}`}
                              className="text-sm font-medium"
                            >
                              Option Text
                            </Label>
                          )}
                          <Input
                            id={`option-text-${index}`}
                            value={option.option_text}
                            onChange={(e) => {
                              if (!editingMCQQuestion) return;
                              setEditingMCQQuestion({
                                ...editingMCQQuestion,
                                options: editingMCQQuestion.options.map(
                                  (opt, i) =>
                                    i === index
                                      ? { ...opt, option_text: e.target.value }
                                      : opt
                                ),
                              });
                            }}
                            placeholder="Option text"
                            disabled={isReadonly}
                          />
                        </div>

                        {/* Type */}
                        <div
                          className={`flex-1 ${index === 0 ? "space-y-2" : ""}`}
                        >
                          {index === 0 && (
                            <Label
                              htmlFor={`option-type-${index}`}
                              className="text-sm font-medium"
                            >
                              Type
                            </Label>
                          )}
                          <Select
                            value={option.type}
                            onValueChange={(value: "discrete" | "freeform") => {
                              if (!editingMCQQuestion) return;
                              setEditingMCQQuestion({
                                ...editingMCQQuestion,
                                options: editingMCQQuestion.options.map(
                                  (opt, i) =>
                                    i === index ? { ...opt, type: value } : opt
                                ),
                              });
                            }}
                            disabled={isReadonly}
                          >
                            <SelectTrigger
                              id={`option-type-${index}`}
                              className="w-32"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="discrete">Discrete</SelectItem>
                              <SelectItem value="freeform">Freeform</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Correct Checkbox (only for discrete) */}
                        <div className={`${index === 0 ? "space-y-2" : ""}`}>
                          {index === 0 && (
                            <Label className="text-sm font-medium block">
                              Correct
                            </Label>
                          )}
                          <div className="flex items-center gap-2 h-10">
                            {option.type === "discrete" ? (
                              <Checkbox
                                checked={option.is_correct}
                                onCheckedChange={(checked) => {
                                  if (!editingMCQQuestion) return;
                                  setEditingMCQQuestion({
                                    ...editingMCQQuestion,
                                    options: editingMCQQuestion.options.map(
                                      (opt, i) =>
                                        i === index
                                          ? {
                                              ...opt,
                                              is_correct: checked === true,
                                            }
                                          : opt
                                    ),
                                  });
                                }}
                                disabled={isReadonly}
                              />
                            ) : (
                              <div className="w-4 h-4" /> // Spacer for alignment
                            )}
                          </div>
                        </div>

                        {/* Delete Button */}
                        {editingMCQQuestion.options.length > 2 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (!editingMCQQuestion) return;
                              setEditingMCQQuestion({
                                ...editingMCQQuestion,
                                options: editingMCQQuestion.options.filter(
                                  (_, i) => i !== index
                                ),
                              });
                            }}
                            className={`h-8 w-8 shrink-0 ${index === 0 ? "mb-0.5" : ""}`}
                            disabled={isReadonly}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          if (!editingMCQQuestion) return;
                          setEditingMCQQuestion({
                            ...editingMCQQuestion,
                            options: [
                              ...editingMCQQuestion.options,
                              {
                                option_text: "",
                                type: "discrete" as const,
                                is_correct: false,
                              },
                            ],
                          });
                        }}
                        disabled={
                          isReadonly || editingMCQQuestion.options.length >= 5
                        }
                        size="sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Option
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeMCQModal}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={saveMCQQuestion}>
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
