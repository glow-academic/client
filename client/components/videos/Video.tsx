/**
 * Video.tsx
 * Video creation and editing component with interactive question timeline
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";
import { Check, Plus, Trash2, X } from "lucide-react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// Custom Components
import { DepartmentPicker } from "@/components/common/forms/DepartmentPicker";
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
}

export default function Video({
  mode = "create",
  videoId,
  videoDetail: serverVideoDetail,
  videoDetailDefault: serverVideoDetailDefault,
  createVideoAction,
  updateVideoAction,
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
    description: string;
    length_seconds: number;
    departmentIds: string[];
    active: boolean;
  };

  const initialFormData: FormData = useMemo(
    () => ({
      name: "",
      description: "",
      length_seconds: 0,
      departmentIds: defaultDepartmentIds,
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

  // Load video data from server response
  useEffect(() => {
    if (videoData && isEditMode && !formDataInitializedRef.current) {
      // Edit mode: load existing video data (only once)
      const deptIds = videoData.department_ids || [];
      setFormData({
        name: videoData.name,
        description: videoData.description,
        length_seconds: videoData.length_seconds,
        departmentIds: deptIds,
        active: videoData.active ?? true,
      });

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
  }, [videoData, isEditMode]);

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
    if (!formData["description"].trim()) {
      newErrors["description"] = "Description is required";
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

      if (isEditMode && videoId) {
        // UPDATE mode
        const updatePayload = {
          videoId,
          name: formData.name,
          description: formData.description,
          length_seconds: formData.length_seconds,
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
        };

        await handleUpdateVideo(updatePayload);
        toast.success("Video updated successfully!");
      } else {
        // CREATE mode
        const createPayload = {
          name: formData.name,
          description: formData.description,
          length_seconds: formData.length_seconds,
          department_ids: finalDepartmentIds,
          active: formData.active,
          questions: questionsForApi,
        };

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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {isEditMode ? "Edit Video" : "Create Video"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode
              ? "Edit video details and configure questions"
              : "Create a new video with interactive questions"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/create/videos")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || isReadonly}>
            {isSubmitting
              ? "Saving..."
              : isEditMode
                ? "Update Video"
                : "Create Video"}
          </Button>
        </div>
      </div>

      {/* Form Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Video Information</CardTitle>
          <CardDescription>Basic information about the video</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
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

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData["description"]}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Enter video description"
              disabled={isReadonly}
              rows={3}
              data-testid="input-video-description"
            />
            {errors["description"] && (
              <p className="text-sm text-destructive">
                {errors["description"]}
              </p>
            )}
          </div>

          {/* Length */}
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
          <div className="flex items-center space-x-2 pt-2">
            <Switch
              id="active"
              checked={formData.active}
              onCheckedChange={(checked) =>
                handleInputChange("active", checked)
              }
              disabled={isReadonly}
            />
            <Label htmlFor="active">Active</Label>
          </div>
        </CardContent>
      </Card>

      {/* Video Player Section */}
      {formData.length_seconds > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Video Player</CardTitle>
            <CardDescription>
              Click on the timeline to add questions at specific times
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video Player Placeholder */}
            <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center">
              <div className="text-white text-center">
                <p className="text-lg mb-2">Video Player</p>
                <p className="text-sm text-gray-400">
                  Video URL will be loaded from endpoint
                </p>
              </div>
            </div>

            {/* Timeline */}
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
                    const time = Math.floor(
                      percentage * formData.length_seconds
                    );
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
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription>
            Questions that appear at specific times in the video
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No questions added yet. Click on the timeline to add questions.
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
                      <p className="font-medium">{question.question_text}</p>
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
                                <Badge variant="outline" className="text-xs">
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
                        onClick={() => openQuestionModal(undefined, question)}
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
        </CardContent>
      </Card>

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
