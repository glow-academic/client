/**
 * Video.tsx
 * Video creation and editing component with interactive question timeline
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import { Check, Plus, Power, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
import {
  PolicyMappingItem,
  PolicyPicker,
} from "@/components/common/forms/PolicyPicker";
import { ProblemStatementAndObjectivesPicker } from "@/components/common/forms/ProblemStatementAndObjectivesPicker";
import { useBreadcrumbContext } from "@/contexts/breadcrumb-context";
import { useProfile } from "@/contexts/profile-context";
import {
  getDefaultDepartmentIds,
  transformDepartmentIdsForSubmit,
} from "@/utils/department-picker-helpers";
import { getObjectivesFromMapping } from "@/utils/scenario-helpers";

// Types and API functions
import type {
  CreateVideoIn,
  CreateVideoOut,
  UpdateVideoIn,
  UpdateVideoOut,
  VideoDetailDefaultOut,
} from "@/app/(main)/create/videos/new/page";
import type { VideoDetailOut } from "@/app/(main)/create/videos/v/[videoId]/page";

// Local question type for editing (IDs optional for new questions)
// Types match the API response structure from VideoDetailOut
type Question = {
  question_id?: string;
  question_text: string;
  type: "choice" | "frq";
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
  videoDetailDefault?: VideoDetailDefaultOut;
  createVideoAction?: (input: CreateVideoIn) => Promise<CreateVideoOut>;
  updateVideoAction?: (input: UpdateVideoIn) => Promise<UpdateVideoOut>;
  randomizeVideoAction?: (
    input: RandomizeVideoIn
  ) => Promise<RandomizeVideoOut>;
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

export default function Video({
  mode = "create",
  videoId,
  videoDetail: serverVideoDetail,
  videoDetailDefault: serverVideoDetailDefault,
  createVideoAction,
  updateVideoAction,
  randomizeVideoAction,
}: VideoProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
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

  // Extract body types for type safety
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

      if (section === "problem_statement" && selectedProblemStatementId) {
        body.problemStatementIds = [selectedProblemStatementId];
      }

      if (section === "objectives" && currentObjectives.length > 0) {
        body.objectiveIds = currentObjectives;
      }

      if (section === "policies" && selectedPolicyIds.length > 0) {
        body.policyIds = selectedPolicyIds;
      }

      const result = await randomizeVideoAction({ body });

      if (result.success) {
        if (
          targets.includes("problem_statement") &&
          result.problemStatementIds.length > 0
        ) {
          const newProblemStatementId = result.problemStatementIds[0]!;
          setSelectedProblemStatementId(newProblemStatementId);
          if (problemStatementMapping[newProblemStatementId]) {
            handleInputChange(
              "problemStatement",
              problemStatementMapping[newProblemStatementId].problem_statement
            );
          }
        }

        if (targets.includes("objectives") && result.objectiveIds.length > 0) {
          // Map objective IDs to text using mapping
          const objectiveTexts = result.objectiveIds
            .map((id) => {
              const mapping = videoData?.objective_mapping || {};
              return mapping[id]?.["name"] || "";
            })
            .filter((text) => text.trim());
          setCurrentObjectives(objectiveTexts);
        }

        if (targets.includes("policies") && result.policyIds.length > 0) {
          setSelectedPolicyIds(result.policyIds);
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

  const handleResetSection = (section: string) => {
    if (section === "problem_statement") {
      setSelectedProblemStatementId(null);
      handleInputChange("problemStatement", "");
    } else if (section === "objectives") {
      setCurrentObjectives([]);
    } else if (section === "policies") {
      setSelectedPolicyIds([]);
    } else if (section === "video_images") {
      setVideoImages([]);
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
  };

  // Problem statement and objectives state
  const [selectedProblemStatementId, setSelectedProblemStatementId] = useState<
    string | null
  >(null);
  const [currentObjectives, setCurrentObjectives] = useState<string[]>([]);
  const [videoImages, setVideoImages] = useState<
    Array<{ id: string; file_path: string; mime_type: string; active: boolean }>
  >([]);

  // Policies state
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);

  // Randomization state
  const [isRandomizing, setIsRandomizing] = useState(false);

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      length_seconds: 0,
      departmentIds: defaultDepartmentIds,
      problemStatement: "",
      active: true,
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

  // Problem statement mapping
  const problemStatementMapping = useMemo(() => {
    return videoData?.problem_statement_mapping || {};
  }, [videoData?.problem_statement_mapping]);

  // Policy mapping
  const policyMapping = useMemo(() => {
    // Server returns dict[str, dict[str, str]] which matches PolicyMappingItem structure
    // Use double assertion to handle index signature compatibility
    return (videoData?.policy_mapping || {}) as unknown as Record<
      string,
      PolicyMappingItem
    >;
  }, [videoData?.policy_mapping]);

  // Objectives history
  const objectivesHistory = useMemo(() => {
    const rawHistory = videoData?.objectives_history || [];
    return Array.isArray(rawHistory) ? rawHistory : [];
  }, [videoData?.objectives_history]);

  // Load video data from server response
  useEffect(() => {
    if (videoData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing video data (only once)
      const deptIds = videoData.department_ids || [];

      // Get problem statement text from mapping or empty string
      const problemStatementText =
        videoData.problem_statement_ids &&
        videoData.problem_statement_ids.length > 0 &&
        videoData.problem_statement_ids[0] &&
        problemStatementMapping[videoData.problem_statement_ids[0]]
          ? problemStatementMapping[videoData.problem_statement_ids[0]]!
              .problem_statement
          : "";

      setFormData({
        name: videoData.name,
        length_seconds: videoData.length_seconds,
        departmentIds: deptIds,
        problemStatement: problemStatementText,
        active: videoData.active ?? true,
      });

      // Load problem statement ID
      if (
        videoData.problem_statement_ids &&
        videoData.problem_statement_ids.length > 0
      ) {
        setSelectedProblemStatementId(videoData.problem_statement_ids[0]!);
      }

      // Load objectives
      if (videoData.objective_ids && videoData.objective_mapping) {
        // Type assert objective_mapping to match getObjectivesFromMapping expected type
        const objectiveMapping = videoData.objective_mapping as Record<
          string,
          { name: string }
        >;
        const objectives = getObjectivesFromMapping(
          videoData.objective_ids,
          objectiveMapping
        );
        setCurrentObjectives(objectives);
      }

      // Load policies
      if (videoData.policy_ids) {
        setSelectedPolicyIds(videoData.policy_ids);
      }

      // Load video images
      if (videoData.video_images && Array.isArray(videoData.video_images)) {
        setVideoImages(
          videoData.video_images.map(
            (img: {
              id?: string;
              file_path?: string;
              mime_type?: string;
              active?: boolean;
            }) => ({
              id: img.id || "",
              file_path: img.file_path || "",
              mime_type: img.mime_type || "",
              active: img.active !== false,
            })
          )
        );
      }

      // Load questions from server data (already strongly typed from API)
      if (videoData.questions && Array.isArray(videoData.questions)) {
        const loadedQuestions: Question[] = videoData.questions.map((q) => ({
          question_id: q.question_id,
          question_text: q.question_text,
          type: q.type as "choice" | "frq",
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
  }, [videoData, isEditMode, problemStatementMapping]);

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
    if (formData["length_seconds"] <= 0) {
      newErrors["length_seconds"] = "Length must be greater than 0";
    }

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
        type: q.type,
        allow_multiple: q.allow_multiple,
        times: q.times,
        options: q.options.map((opt) => ({
          option_text: opt.option_text,
          type: opt.type,
          is_correct: opt.is_correct,
        })),
      }));

      // Get problem statement IDs (create new if needed)
      let problemStatementIds: string[] = [];
      if (selectedProblemStatementId) {
        problemStatementIds = [selectedProblemStatementId];
      } else if (formData.problemStatement.trim()) {
        // TODO: Create new problem statement and get ID
        // For now, we'll need to create it via API or handle it differently
        // This is a placeholder - the actual implementation would create a new problem statement
        toast.warning("Problem statement creation not yet implemented");
      }

      // Get objective IDs (create new if needed)
      // TODO: Create objectives and get IDs - for now using empty array
      const objectiveIds: string[] = [];

      // Get video image IDs
      const videoImageIds = videoImages.map((img) => img.id).filter(Boolean);

      if (isEditMode && videoId) {
        // UPDATE mode
        const updatePayload: UpdateVideoBody = {
          videoId,
          name: formData.name,
          length_seconds: formData.length_seconds,
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
        };

        if (problemStatementIds.length > 0) {
          updatePayload.problem_statement_ids = problemStatementIds;
        }
        if (objectiveIds.length > 0) {
          updatePayload.objective_ids = objectiveIds;
        }
        if (selectedPolicyIds.length > 0) {
          updatePayload.policy_ids = selectedPolicyIds;
        }
        if (videoImageIds.length > 0) {
          updatePayload.video_image_ids = videoImageIds;
        }

        await handleUpdateVideo(updatePayload);
        toast.success("Video updated successfully!");
      } else {
        // CREATE mode
        const createPayload: CreateVideoBody = {
          name: formData.name,
          length_seconds: formData.length_seconds,
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
        };

        if (problemStatementIds.length > 0) {
          createPayload.problem_statement_ids = problemStatementIds;
        }
        if (objectiveIds.length > 0) {
          createPayload.objective_ids = objectiveIds;
        }
        if (selectedPolicyIds.length > 0) {
          createPayload.policy_ids = selectedPolicyIds;
        }
        if (videoImageIds.length > 0) {
          createPayload.video_image_ids = videoImageIds;
        }

        await handleCreateVideo(createPayload);
        toast.success("Video created successfully!");
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

  // Question modal state
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | null>(null);

  const openQuestionModal = (time?: number, question?: Question) => {
    setSelectedTime(time ?? null);
    if (question) {
      setEditingQuestion(question);
    } else {
      setEditingQuestion({
        question_text: "",
        type: "choice",
        allow_multiple: false,
        times: time !== undefined ? [time] : [],
        options: [],
      });
    }
    setShowQuestionModal(true);
  };

  const closeQuestionModal = () => {
    setShowQuestionModal(false);
    setEditingQuestion(null);
    setSelectedTime(null);
  };

  const saveQuestion = () => {
    if (!editingQuestion) return;

    if (!editingQuestion.question_text.trim()) {
      toast.error("Question text is required");
      return;
    }

    if (
      editingQuestion.type === "choice" &&
      editingQuestion.options.length === 0
    ) {
      toast.error("Choice questions must have at least one option");
      return;
    }

    if (editingQuestion.times.length === 0) {
      toast.error("Question must have at least one time");
      return;
    }

    if (editingQuestion.type === "choice") {
      const hasCorrect = editingQuestion.options.some((opt) => opt.is_correct);
      if (!hasCorrect) {
        toast.error("Choice questions must have at least one correct answer");
        return;
      }
    }

    if (editingQuestion.question_id) {
      // Update existing question
      setQuestions((prev) =>
        prev.map((q) =>
          q.question_id === editingQuestion.question_id ? editingQuestion : q
        )
      );
    } else {
      // Add new question
      setQuestions((prev) => [...prev, editingQuestion]);
    }

    closeQuestionModal();
  };

  const deleteQuestion = (questionId?: string) => {
    if (!questionId) return;
    setQuestions((prev) => prev.filter((q) => q.question_id !== questionId));
  };

  const addOption = () => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: [
        ...editingQuestion.options,
        {
          option_text: "",
          type: "discrete" as const,
          is_correct: false,
        } as QuestionOption,
      ],
    });
  };

  const removeOption = (index: number) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: editingQuestion.options.filter((_, i) => i !== index),
    });
  };

  const updateOption = (
    index: number,
    field: keyof QuestionOption,
    value: string | boolean
  ) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      options: editingQuestion.options.map((opt, i) =>
        i === index ? { ...opt, [field]: value } : opt
      ),
    });
  };

  const addTime = (time: number) => {
    if (!editingQuestion) return;
    if (!editingQuestion.times.includes(time)) {
      setEditingQuestion({
        ...editingQuestion,
        times: [...editingQuestion.times, time].sort((a, b) => a - b),
      });
    }
  };

  const removeTime = (time: number) => {
    if (!editingQuestion) return;
    setEditingQuestion({
      ...editingQuestion,
      times: editingQuestion.times.filter((t) => t !== time),
    });
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
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
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
      setUploadedVideoFile(file);
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
      setUploadedVideoFile(file);
    }
  };

  const handleRemoveVideo = () => {
    setUploadedVideoFile(null);
    handleInputChange("length_seconds", 0);
  };

  return (
    <div className="space-y-6 py-4 px-4">
      {/* Form Fields */}
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Video Name *</Label>
          <Input
            id="name"
            value={formData["name"]}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Enter video name"
            disabled={isReadonly}
            data-testid="input-video-name"
          />
          {errors["name"] && (
            <p className="text-sm text-destructive">{errors["name"]}</p>
          )}
        </div>

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
      </div>

      {/* Problem Statement & Objectives Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Problem Statement & Objectives
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  handleRandomizeVideo(
                    ["problem_statement", "objectives"],
                    "problem_statement"
                  )
                }
                disabled={isRandomizing || isReadonly}
              >
                {isRandomizing ? "Randomizing..." : "Randomize"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleResetSection("problem_statement")}
                    disabled={isReadonly}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProblemStatementAndObjectivesPicker
            problemStatementMapping={problemStatementMapping}
            selectedProblemStatementId={selectedProblemStatementId}
            onProblemStatementSelect={setSelectedProblemStatementId}
            onProblemStatementCreateNew={() => {
              setSelectedProblemStatementId(null);
              handleInputChange("problemStatement", "");
            }}
            problemStatement={formData.problemStatement}
            onProblemStatementChange={(value) =>
              handleInputChange("problemStatement", value)
            }
            objectives={currentObjectives}
            onObjectivesChange={setCurrentObjectives}
            objectivesHistory={objectivesHistory}
            enableVideoImages={true}
            videoImages={videoImages}
            onVideoImagesChange={setVideoImages}
            disabled={isSubmitting}
            readonly={isReadonly}
            entityType="video"
          />
        </CardContent>
      </Card>

      {/* Policies Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Policies</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRandomizeVideo(["policies"], "policies")}
                disabled={isRandomizing || isReadonly}
              >
                {isRandomizing ? "Randomizing..." : "Randomize"}
              </Button>
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
          </div>
        </CardHeader>
        <CardContent>
          <PolicyPicker
            mapping={policyMapping}
            validIds={videoData?.valid_policy_ids || []}
            selectedIds={selectedPolicyIds}
            onSelect={setSelectedPolicyIds}
            multiSelect={true}
            label="Policies"
            placeholder="Select policies..."
            description="Choose policies that will be available for this video."
            disabled={isSubmitting}
            readonly={isReadonly}
          />
        </CardContent>
      </Card>

      {/* Questions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              {questions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No questions added yet. Click on the timeline to add
                  questions.
                </p>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={question.question_id || index}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">
                              {question.type.toUpperCase()}
                            </Badge>
                            {question.allow_multiple && (
                              <Badge variant="secondary">Multiple</Badge>
                            )}
                            <span className="text-sm text-muted-foreground">
                              Times: {question.times.map(formatTime).join(", ")}
                            </span>
                          </div>
                          <p className="font-medium">
                            {question.question_text}
                          </p>
                          {question.type === "choice" &&
                            question.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {question.options.map((opt, optIdx) => (
                                  <div
                                    key={optIdx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    {opt.is_correct && (
                                      <Check className="h-4 w-4 text-green-600" />
                                    )}
                                    <span
                                      className={
                                        opt.is_correct ? "font-semibold" : ""
                                      }
                                    >
                                      {opt.option_text}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {opt.type}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openQuestionModal(undefined, question)
                            }
                            disabled={isReadonly}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Video Generation/Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Video Generation/Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Video Upload */}
          <div className="space-y-2">
            <Label>Video Upload</Label>
            {uploadedVideoFile && videoObjectUrl ? (
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
            ) : (
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
                  if (!isReadonly) {
                    document.getElementById("video-upload-input")?.click();
                  }
                }}
              >
                <input
                  id="video-upload-input"
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  disabled={isReadonly}
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
            )}
          </div>

          {/* Length Field - Only show if no video is uploaded */}
          {!uploadedVideoFile && (
            <div className="space-y-2">
              <Label htmlFor="length_seconds">Length (seconds) *</Label>
              <Input
                id="length_seconds"
                type="number"
                min="1"
                value={formData["length_seconds"]}
                onChange={(e) =>
                  handleInputChange(
                    "length_seconds",
                    parseInt(e.target.value) || 0
                  )
                }
                placeholder="Enter video length in seconds"
                disabled={isReadonly}
                data-testid="input-video-length"
              />
              {errors["length_seconds"] && (
                <p className="text-sm text-destructive">
                  {errors["length_seconds"]}
                </p>
              )}
            </div>
          )}

          {/* Video Generation (TODO placeholder) */}
          <div className="space-y-2">
            <Label>Video Generation</Label>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // TODO: Implement video generation
                toast.info(
                  "Video generation coming soon! For now, please upload a video."
                );
              }}
              disabled={isReadonly}
            >
              Generate Video (TODO)
            </Button>
            <p className="text-xs text-muted-foreground">
              AI-powered video generation will be available soon. For now,
              please upload a video file.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Timeline (only show if length > 0) */}
      {formData.length_seconds > 0 && (
        <div className="space-y-2">
          <Label>Timeline</Label>
          <div className="relative w-full h-12 bg-gray-200 rounded-lg overflow-hidden">
            {/* Timeline markers */}
            {allQuestionTimes.map((time) => (
              <Tooltip key={time}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      const question = questions.find((q) =>
                        q.times.includes(time)
                      );
                      if (question) {
                        openQuestionModal(time, question);
                      } else {
                        openQuestionModal(time);
                      }
                    }}
                    className="absolute top-0 w-3 h-full bg-blue-600 hover:bg-blue-700 cursor-pointer z-10"
                    style={{
                      left: `${(time / formData.length_seconds) * 100}%`,
                    }}
                    disabled={isReadonly}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{formatTime(time)}</p>
                </TooltipContent>
              </Tooltip>
            ))}

            {/* Clickable timeline */}
            <div
              className="absolute inset-0 cursor-pointer"
              onClick={(e) => {
                if (isReadonly) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = x / rect.width;
                const time = Math.floor(percentage * formData.length_seconds);
                openQuestionModal(time);
              }}
            />

            {/* Time labels */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-gray-600">
              <span>0:00</span>
              <span>{formatTime(formData.length_seconds)}</span>
            </div>
          </div>
        </div>
      )}

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

      {/* Question Modal */}
      {showQuestionModal && editingQuestion && (
        <AlertDialog open={showQuestionModal} onOpenChange={closeQuestionModal}>
          <AlertDialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {editingQuestion.question_id ? "Edit Question" : "Add Question"}
              </AlertDialogTitle>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              {/* Question Text */}
              <div className="space-y-2">
                <Label>Question Text *</Label>
                <Textarea
                  value={editingQuestion.question_text}
                  onChange={(e) =>
                    setEditingQuestion({
                      ...editingQuestion,
                      question_text: e.target.value,
                    })
                  }
                  placeholder="Enter question text"
                  rows={3}
                />
              </div>

              {/* Question Type */}
              <div className="space-y-2">
                <Label>Question Type *</Label>
                <Select
                  value={editingQuestion.type}
                  onValueChange={(value: "choice" | "frq") =>
                    setEditingQuestion({
                      ...editingQuestion,
                      type: value,
                      options: value === "frq" ? [] : editingQuestion.options,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="choice">Choice</SelectItem>
                    <SelectItem value="frq">Free Response (FRQ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Allow Multiple (for choice) */}
              {editingQuestion.type === "choice" && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="allow_multiple"
                    checked={editingQuestion.allow_multiple}
                    onCheckedChange={(checked) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        allow_multiple: checked === true,
                      })
                    }
                  />
                  <Label htmlFor="allow_multiple">
                    Allow multiple selections
                  </Label>
                </div>
              )}

              {/* Times */}
              <div className="space-y-2">
                <Label>Times (seconds) *</Label>
                <div className="flex flex-wrap gap-2">
                  {editingQuestion.times.map((time) => (
                    <Badge
                      key={time}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {formatTime(time)}
                      <button
                        type="button"
                        onClick={() => removeTime(time)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {selectedTime !== null &&
                    !editingQuestion.times.includes(selectedTime) && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addTime(selectedTime)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add {formatTime(selectedTime)}
                      </Button>
                    )}
                </div>
                <Input
                  type="number"
                  min="0"
                  max={formData.length_seconds}
                  placeholder="Add time in seconds"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const value = parseInt(e.currentTarget.value);
                      if (
                        !isNaN(value) &&
                        value >= 0 &&
                        value <= formData.length_seconds
                      ) {
                        addTime(value);
                        e.currentTarget.value = "";
                      }
                    }
                  }}
                />
              </div>

              {/* Options (for choice questions) */}
              {editingQuestion.type === "choice" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Options *</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editingQuestion.options.map((option, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 border rounded"
                      >
                        <Input
                          value={option.option_text}
                          onChange={(e) =>
                            updateOption(index, "option_text", e.target.value)
                          }
                          placeholder="Option text"
                          className="flex-1"
                        />
                        <Select
                          value={option.type}
                          onValueChange={(value: "discrete" | "freeform") =>
                            updateOption(index, "type", value)
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discrete">Discrete</SelectItem>
                            <SelectItem value="freeform">Freeform</SelectItem>
                          </SelectContent>
                        </Select>
                        <Checkbox
                          checked={option.is_correct}
                          onCheckedChange={(checked) =>
                            updateOption(index, "is_correct", checked === true)
                          }
                        />
                        <Label className="text-sm">Correct</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={closeQuestionModal}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={saveQuestion}>Save</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
