/**
 * ContentSection.tsx
 * Scenario-specific content section component
 */
"use client";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  FileText,
  GripVertical,
  Image,
  Loader2,
  MessageSquare,
  PlusCircle,
  RotateCcw,
  Target,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

type PersonaMappingItem =
  components["schemas"]["QGetScenarioDetailV4Persona"];

type StepStatus = "pending" | "active" | "completed";

// Utility function to generate gradient from hex color
const generateGradientFromHex = (hexColor: string): string => {
  const cleanHex = hexColor.replace("#", "");
  const r = parseInt(cleanHex.substr(0, 2), 16);
  const g = parseInt(cleanHex.substr(2, 2), 16);
  const b = parseInt(cleanHex.substr(4, 2), 16);
  const lighterR = Math.min(255, r + 60);
  const lighterG = Math.min(255, g + 60);
  const lighterB = Math.min(255, b + 60);
  const lighterHex = `#${lighterR.toString(16).padStart(2, "0")}${lighterG.toString(16).padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
  return `linear-gradient(135deg, ${lighterHex} 0%, ${hexColor} 100%)`;
};

// Component for objective input with autocomplete
function ObjectiveInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedObjectiveIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalObjectives: _totalObjectives,
  maxObjectives: _maxObjectives,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedObjectiveIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove?: () => void;
  totalObjectives: number;
  maxObjectives: number;
}) {
  // objectivesEnabled is kept for API compatibility but not used {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];
    const valueLower = value.toLowerCase().trim();
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        if (sLower === valueLower) return false;
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5);
    return matching;
  }, [suggestions, value]);

  const handleSelect = (suggestion: string) => {
    onChange(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    if (value && filteredSuggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        draggedObjectiveIndex === index && "opacity-50"
      )}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2">
        <div
          draggable={!disabled}
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing shrink-0"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            className="flex-1"
            disabled={disabled}
            onDragStart={(e) => e.preventDefault()}
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Show delete button only if onRemove is provided */}
        {onRemove && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onRemove}
            className="h-8 w-8 shrink-0"
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export interface ProblemStatementInfo {
  name: string;
  problem_statement: string;
  created_at: string;
  updated_at: string;
}

export interface ImageMappingItem {
  id: string;
  name: string;
  upload_id?: string;
  file_path?: string;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentSectionProps {
  // Problem Statement
  problemStatement: string;
  problemStatementMapping: Record<string, ProblemStatementInfo>;
  currentProblemStatementIds: string[];
  selectedProblemStatementId?: string | undefined;
  hasProblemStatementChanges: boolean;
  originalProblemStatement: string;
  useProblemStatement: boolean;

  // Objectives
  initialObjectives?: string[];
  objectivesHistory: string[];
  useObjectives: boolean;

  // Images
  useImage: boolean;
  initialImage?: { id: string; name: string; upload_id: string } | null;
  imageMapping: Record<string, ImageMappingItem>;
  isUploadingImage: boolean;

  // Videos
  useVideo: boolean;
  initialSelectedVideo?: {
    id: string;
    name: string;
    length_seconds: number;
    upload_id?: string;
  } | null;
  videoMapping: Record<
    string,
    { id: string; name: string; length_seconds: number; upload_id?: string }
  >;
  initialActiveVideoId?: string | null;
  selectedVideoLength: number | null;
  onVideoLengthChange: (length: number | null) => void;

  // Questions
  useQuestions: boolean;
  initialQuestions?: Array<{
    id: string;
    question_text: string;
    allow_multiple: boolean;
    options: Array<{
      id: string;
      option_text: string;
      type?: "discrete" | "freeform";
      is_correct: boolean;
    }>;
    times?: number[];
  }>;
  initialCurrentQuestionIds?: string[];

  // Documents Preview
  allPreviewDocumentIds: string[];
  documentMapping: Record<string, DocumentMappingItem>;
  initialScenarioPreviewDocumentId?: string | null;
  documentDetails?: Array<{
    document_id: string;
    upload_id?: string | null;
    [key: string]: unknown;
  }>;
  templateDocumentIds: string[];

  // Personas (for preview)
  selectedPersonaIds: string[];
  personaMapping: Record<string, PersonaMappingItem>;

  // Callbacks
  onProblemStatementChange: (value: string) => void;
  onProblemStatementVersionSelect: (id: string) => void;
  onResetProblemStatement: () => void;
  onUseProblemStatementChange: (enabled: boolean) => void;
  onUseObjectivesChange: (enabled: boolean) => void;
  onUseImageChange: (enabled: boolean) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUseVideoChange: (enabled: boolean) => void;
  onUseQuestionsChange: (enabled: boolean) => void;
  onStateChange?: (state: {
    image: { id: string; name: string; upload_id: string } | null;
    selectedVideo: {
      id: string;
      name: string;
      length_seconds: number;
      upload_id?: string;
    } | null;
    activeVideoId: string | null;
    questions: Array<{
      id: string;
      question_text: string;
      allow_multiple: boolean;
      options: Array<{
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }>;
      times?: number[];
    }>;
    currentQuestionIds: string[];
    objectives: string[];
    scenarioPreviewDocumentId: string | null;
  }) => void;
  onScenarioPreviewDocumentChange?: (docId: string | null) => void;
  onDocumentRemove: (docId: string) => void;
  onGenerate: (instructions?: string, regenerateObjectives?: boolean) => void;
  onResetContent: () => void;
  onShowRegenerationDialog: () => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  isGeneratingScenario: boolean;
  isSubmitting: boolean;
  imageInputRef: React.RefObject<HTMLInputElement>;
  isEditMode?: boolean;
}

export function ContentSection({
  problemStatement,
  problemStatementMapping,
  currentProblemStatementIds: _currentProblemStatementIds,
  selectedProblemStatementId,
  hasProblemStatementChanges,
  originalProblemStatement: _originalProblemStatement,
  useProblemStatement,
  initialObjectives = [],
  objectivesHistory,
  useObjectives,
  useImage,
  initialImage = null,
  imageMapping,
  isUploadingImage,
  useVideo,
  initialSelectedVideo = null,
  videoMapping,
  initialActiveVideoId = null,
  selectedVideoLength,
  onVideoLengthChange,
  useQuestions,
  initialQuestions = [],
  initialCurrentQuestionIds = [],
  allPreviewDocumentIds,
  documentMapping,
  initialScenarioPreviewDocumentId = null,
  documentDetails,
  templateDocumentIds: _templateDocumentIds,
  selectedPersonaIds,
  personaMapping,
  onProblemStatementChange,
  onProblemStatementVersionSelect: _onProblemStatementVersionSelect,
  onResetProblemStatement,
  onUseProblemStatementChange,
  onUseObjectivesChange,
  onUseImageChange,
  onImageUpload,
  onUseQuestionsChange,
  onStateChange,
  onScenarioPreviewDocumentChange,
  onDocumentRemove,
  onGenerate,
  onResetContent,
  onShowRegenerationDialog,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  isGeneratingScenario,
  isSubmitting,
  imageInputRef,
  isEditMode = false,
}: ContentSectionProps) {
  // Internal state for content section
  const [image, setImage] = useState<{
    id: string;
    name: string;
    upload_id: string;
  } | null>(initialImage ?? null);
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    name: string;
    length_seconds: number;
    upload_id?: string;
  } | null>(initialSelectedVideo ?? null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(
    initialActiveVideoId ?? null
  );
  const [questions, setQuestions] = useState<
    Array<{
      id: string;
      question_text: string;
      allow_multiple: boolean;
      options: Array<{
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }>;
      times?: number[];
    }>
  >(initialQuestions ?? []);
  const [currentQuestionIds, setCurrentQuestionIds] = useState<string[]>(
    initialCurrentQuestionIds ?? []
  );
  const [scenarioPreviewDocumentId, setScenarioPreviewDocumentId] = useState<
    string | null
  >(initialScenarioPreviewDocumentId ?? null);
  const [objectives, setObjectives] = useState<string[]>(initialObjectives ?? []);
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);
  const [draggedQuestionIndex, setDraggedQuestionIndex] = useState<
    number | null
  >(null);
  const [draggedOptionIndex, setDraggedOptionIndex] = useState<{
    questionIndex: number;
    optionIndex: number;
  } | null>(null);

  // Initialize from props when they change (for edit mode)
  useEffect(() => {
    if (initialImage !== undefined) {
      setImage(initialImage);
    }
  }, [initialImage]);

  useEffect(() => {
    if (initialSelectedVideo !== undefined) {
      setSelectedVideo(initialSelectedVideo);
    }
  }, [initialSelectedVideo]);

  useEffect(() => {
    if (initialActiveVideoId !== undefined) {
      setActiveVideoId(initialActiveVideoId);
    }
  }, [initialActiveVideoId]);

  useEffect(() => {
    if (initialQuestions !== undefined) {
      setQuestions(initialQuestions);
    }
  }, [initialQuestions]);

  useEffect(() => {
    if (initialCurrentQuestionIds !== undefined) {
      setCurrentQuestionIds(initialCurrentQuestionIds);
    }
  }, [initialCurrentQuestionIds]);

  useEffect(() => {
    if (initialScenarioPreviewDocumentId !== undefined) {
      setScenarioPreviewDocumentId(initialScenarioPreviewDocumentId);
    }
  }, [initialScenarioPreviewDocumentId]);

  useEffect(() => {
    if (initialObjectives !== undefined) {
      setObjectives(initialObjectives);
    }
  }, [initialObjectives]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      image,
      selectedVideo,
      activeVideoId,
      questions,
      currentQuestionIds,
      objectives,
      scenarioPreviewDocumentId,
    });
  }, [
    image,
    selectedVideo,
    activeVideoId,
    questions,
    currentQuestionIds,
    objectives,
    scenarioPreviewDocumentId,
    onStateChange,
  ]);
  // Local state for multiple images when useVideo is true
  const [selectedImages, setSelectedImages] = useState<
    Array<{ id: string; name: string; upload_id: string }>
  >(image ? [image] : []);

  // Update local state when image prop changes
  useEffect(() => {
    if (useVideo) {
      // Multi-select mode: add image if not already in array
      if (image) {
        setSelectedImages((prev) => {
          const exists = prev.some((img) => img.id === image.id);
          if (exists) {
            return prev; // Already in array, don't change
          }
          return [...prev, image]; // Add new image
        });
      }
      // Note: When image is null in multi-select mode, we don't clear selectedImages
      // because users remove images individually via the trash button
    } else {
      // Single select mode: replace array
      if (image) {
        setSelectedImages([image]);
      } else {
        setSelectedImages([]);
      }
    }
  }, [image, useVideo]);

  // State for document preview dialog
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );

  // State for image preview dialog
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);

  // State for expanded questions (which questions have their options visible)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set()
  );

  // Refs to measure question text input widths for option alignment
  const questionInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [optionMaxWidths, setOptionMaxWidths] = useState<
    Record<number, number | undefined>
  >({});

  // Update option max widths when question inputs resize
  useEffect(() => {
    const updateWidths = () => {
      const widths: Record<number, number | undefined> = {};
      // Base space: gap (gap-2 = 8px) + checkbox width (w-8 = 32px) = 40px
      // Extra space (only if delete button is shown): gap (gap-2 = 8px) + delete button width (w-8 = 32px) = 40px
      // Delete button is only shown when question.options.length > 2
      Object.entries(questionInputRefs.current).forEach(([indexStr, el]) => {
        if (el) {
          const index = parseInt(indexStr, 10);
          const question = questions[index];
          // Base subtraction: gap + checkbox = 40px
          // Extra subtraction (only if delete button shown): gap + delete button = 40px
          const baseSpace = 40; // gap + checkbox
          const deleteButtonSpace =
            question && question.options.length > 2 ? 40 : 0; // gap + delete button (only if shown)
          const totalSpace = baseSpace + deleteButtonSpace;
          // Calculate option input max width: question input width - total space
          const calculatedWidth = el.offsetWidth - totalSpace;
          widths[index] = calculatedWidth > 0 ? calculatedWidth : undefined;
        }
      });
      setOptionMaxWidths(widths);
    };

    // Initial update
    updateWidths();

    // Set up ResizeObserver for each question input
    const observers: ResizeObserver[] = [];
    Object.values(questionInputRefs.current).forEach((el) => {
      if (el) {
        const observer = new ResizeObserver(() => {
          updateWidths();
        });
        observer.observe(el);
        observers.push(observer);
      }
    });

    // Update on window resize as fallback
    window.addEventListener("resize", updateWidths);

    return () => {
      observers.forEach((observer) => observer.disconnect());
      window.removeEventListener("resize", updateWidths);
    };
  }, [questions, selectedVideoLength, expandedQuestions]); // Recalculate when questions, video length, or expansion changes

  // Compute max images/questions based on selected video length
  const maxImages = useMemo(() => {
    if (!useVideo) return 1; // Single image mode
    if (selectedVideoLength === 4) return 2;
    if (selectedVideoLength === 8) return 3;
    if (selectedVideoLength === 12) return 4;
    return 4; // Default when no length selected
  }, [useVideo, selectedVideoLength]);

  const maxQuestions = useMemo(() => {
    if (!useVideo) return 0; // No questions when video disabled
    if (selectedVideoLength === 4) return 2;
    if (selectedVideoLength === 8) return 3;
    if (selectedVideoLength === 12) return 4;
    return 4; // Default when no length selected
  }, [useVideo, selectedVideoLength]);

  // Filter videos by selected length (only if length is selected)
  const filteredVideoMapping = useMemo(() => {
    if (selectedVideoLength === null) {
      return videoMapping; // Show all videos when no length selected
    }
    const filtered: typeof videoMapping = {};
    Object.entries(videoMapping).forEach(([id, video]) => {
      if (video.length_seconds === selectedVideoLength) {
        filtered[id] = video;
      }
    });
    return filtered;
  }, [videoMapping, selectedVideoLength]);

  // Helper function to toggle question expansion
  const toggleQuestionExpanded = (index: number) => {
    setExpandedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Objective handlers (moved from Scenario.tsx)
  const addObjective = () => {
    const maxObjectives = 3; // Hardcoded max of 3
    if (objectives.length >= maxObjectives) {
      toast.error(`Maximum ${maxObjectives} objectives allowed`);
      return;
    }
    setObjectives((prev) => [...prev, ""]);
  };

  const removeObjective = (index: number) => {
    setObjectives((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const updateObjective = (index: number, value: string) => {
    setObjectives((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleDragStartObjective = (e: React.DragEvent, index: number) => {
    setDraggedObjectiveIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverObjective = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropObjective = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedObjectiveIndex === null) return;
    setObjectives((prev) => {
      const next = [...prev];
      const [removed] = next.splice(draggedObjectiveIndex, 1);
      next.splice(targetIndex, 0, removed || "");
      return next;
    });
    setDraggedObjectiveIndex(null);
  };

  // Question handlers (moved from Scenario.tsx)
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
    setQuestions((prev) => {
      const next = [...prev];
      const removed = next[draggedQuestionIndex];
      if (!removed) return next;
      next.splice(draggedQuestionIndex, 1);
      next.splice(targetIndex, 0, removed);
      return next;
    });
    setDraggedQuestionIndex(null);
  };

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
    if (draggedOptionIndex === null) return;
    if (
      draggedOptionIndex.questionIndex !== questionIndex ||
      draggedOptionIndex.optionIndex === targetOptionIndex
    ) {
      setDraggedOptionIndex(null);
      return;
    }
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[draggedOptionIndex.questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const removed = options[draggedOptionIndex.optionIndex];
      if (!removed) return next;
      options.splice(draggedOptionIndex.optionIndex, 1);
      options.splice(targetOptionIndex, 0, removed);
      next[draggedOptionIndex.questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
    setDraggedOptionIndex(null);
  };

  const handleUpdateQuestion = (
    index: number,
    question: {
      id: string;
      question_text: string;
      allow_multiple: boolean;
      options: Array<{
        id: string;
        option_text: string;
        type?: "discrete" | "freeform";
        is_correct: boolean;
      }>;
      times?: number[];
    }
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = question;
      return next;
    });
  };

  const handleQuestionTimesChange = (index: number, times: number[]) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[index];
      if (!question) return next;
      next[index] = {
        ...question,
        times,
      };
      return next;
    });
  };

  const handleAddOption = (questionIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      next[questionIndex] = {
        ...question,
        options: [
          ...question.options,
          {
            id: "",
            option_text: "",
            type: "discrete",
            is_correct: false,
          },
        ],
      };
      return next;
    });
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      next[questionIndex] = {
        ...question,
        options: question.options.filter((_, i) => i !== optionIndex),
      };
      return next;
    });
  };

  const handleOptionChange = (
    questionIndex: number,
    optionIndex: number,
    option: {
      id: string;
      option_text: string;
      type?: "discrete" | "freeform";
      is_correct: boolean;
    }
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const existingOption = options[optionIndex];
      if (!existingOption) return next;
      options[optionIndex] = option;
      next[questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
  };

  const handleToggleOptionCorrect = (
    questionIndex: number,
    optionIndex: number
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      const question = next[questionIndex];
      if (!question) return next;
      const options = [...question.options];
      const existingOption = options[optionIndex];
      if (!existingOption) return next;
      options[optionIndex] = {
        ...existingOption,
        is_correct: !existingOption.is_correct,
      };
      next[questionIndex] = {
        ...question,
        options,
      };
      return next;
    });
  };

  // Image/video handlers
  const handleImageSelect = (
    selectedImage: {
      id: string;
      name: string;
      upload_id: string;
    } | null
  ) => {
    setImage(selectedImage);
  };

  const handleVideoSelect = (
    video: {
      id: string;
      name: string;
      length_seconds: number;
      upload_id?: string;
    } | null
  ) => {
    setSelectedVideo(video);
    setActiveVideoId(video?.id || null);
  };

  // Update currentQuestionIds when questions change
  useEffect(() => {
    setCurrentQuestionIds(questions.map((q) => q.id));
  }, [questions]);

  // Helper function to handle question time change
  const handleQuestionTimeChange = (index: number, range: [number, number]) => {
    // Extract the second value (the actual question time) from the range
    const time = range[1];
    // Use selectedVideoLength if available, otherwise fall back to selectedVideo length, or default to 8 seconds
    const estimatedVideoLength =
      selectedVideoLength || selectedVideo?.length_seconds || 8;
    if (isNaN(time) || time < 0 || time > estimatedVideoLength) {
      return;
    }
    const newTimes = [time];
    handleQuestionTimesChange(index, newTimes);
  };

  // Helper function to handle question text change
  const handleQuestionTextChange = (index: number, text: string) => {
    const currentQuestion = questions[index];
    if (!currentQuestion) return;
    handleUpdateQuestion(index, {
      ...currentQuestion,
      question_text: text,
    });
  };

  // State for document navigation
  const currentDocumentIndex = useMemo(() => {
    if (!scenarioPreviewDocumentId || allPreviewDocumentIds.length === 0) {
      return 0;
    }
    const index = allPreviewDocumentIds.indexOf(scenarioPreviewDocumentId);
    return index >= 0 ? index : 0;
  }, [scenarioPreviewDocumentId, allPreviewDocumentIds]);

  const goToPreviousDocument = () => {
    if (currentDocumentIndex > 0) {
      const previousDocId = allPreviewDocumentIds[currentDocumentIndex - 1];
      onScenarioPreviewDocumentChange?.(previousDocId ?? null);
    }
  };

  const goToNextDocument = () => {
    if (currentDocumentIndex < allPreviewDocumentIds.length - 1) {
      const nextDocId = allPreviewDocumentIds[currentDocumentIndex + 1];
      setScenarioPreviewDocumentId(nextDocId ?? null);
      onScenarioPreviewDocumentChange?.(nextDocId ?? null);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            disabled={isUploadingImage || isReadonly}
            className="hidden"
          />
          {useVideo && (
            <GenericPicker
              items={[
                { value: null, label: "None" },
                { value: 4, label: "4s" },
                { value: 8, label: "8s" },
                { value: 12, label: "12s" },
              ]}
              itemIds={["none", "4", "8", "12"]}
              selectedIds={
                selectedVideoLength !== null
                  ? [String(selectedVideoLength)]
                  : ["none"]
              }
              onSelect={(ids) => {
                const value = ids[0];
                if (!value) return;
                if (value === "none") {
                  onVideoLengthChange(null);
                } else {
                  const parsed = parseInt(value, 10);
                  if ([4, 8, 12].includes(parsed)) {
                    onVideoLengthChange(parsed);
                  }
                }
              }}
              getId={(item) => {
                if (item.value === null) return "none";
                return String(item.value);
              }}
              getLabel={(item) => item.label}
              getSearchText={(item) => item.label}
              renderButton={(selectedItems) => {
                if (selectedItems.length === 0) {
                  return "Length";
                }
                const selectedItem = selectedItems[0] as
                  | { value: number | null; label: string }
                  | undefined;
                return selectedItem?.label || "Length";
              }}
              renderItem={(item, isSelected) => {
                const itemTyped = item as {
                  value: number | null;
                  label: string;
                };
                return (
                  <div className="flex items-center gap-2 py-3 w-full">
                    <Check
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="font-medium">{itemTyped.label}</span>
                  </div>
                );
              }}
              disabled={isReadonly}
              multiSelect={false}
              hideSelectedChips={true}
              buttonClassName="h-8 w-[100px] justify-between"
              compact={true}
              placeholder="Length"
            />
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (problemStatement && problemStatement.trim()) {
                onShowRegenerationDialog();
              } else {
                onGenerate(undefined, true);
              }
            }}
            disabled={isSubmitting || isGeneratingScenario || isReadonly}
          >
            {isGeneratingScenario ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {problemStatement ? "Regenerating..." : "Generating..."}
              </>
            ) : problemStatement ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={onResetContent}
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
        {/* Use Image/Images Switch */}
        {!useImage ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="use-image"
                  className="text-sm flex items-center gap-1.5"
                >
                  <Image
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="Image icon"
                  />
                  {useVideo ? "Images" : "Image"}
                </Label>
                <Switch
                  id="use-image"
                  checked={useImage}
                  onCheckedChange={(checked) => {
                    onUseImageChange(checked);
                    if (!checked) {
                      handleImageSelect(null);
                    }
                  }}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                {useVideo
                  ? "Add images alongside video content"
                  : "Use scenario background image"}
              </p>
            </div>
          </div>
        ) : (
          /* Image Picker and Preview Section (horizontal scrollable) */
          <div className="space-y-2">
            {/* Images Label, Switch, and Picker - Horizontal Layout */}
            {Object.keys(imageMapping).length > 0 && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="use-image"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Image
                      className="h-3.5 w-3.5 text-muted-foreground"
                      aria-label="Image icon"
                    />
                    {useVideo ? "Images" : "Image"}
                  </Label>
                  <Switch
                    id="use-image"
                    checked={useImage}
                    onCheckedChange={(checked) => {
                      onUseImageChange(checked);
                      if (!checked) {
                        handleImageSelect(null);
                      }
                    }}
                    disabled={isReadonly}
                  />
                </div>
                <GenericPicker
                  items={imageMapping}
                  itemIds={Object.keys(imageMapping)}
                  selectedIds={
                    useVideo
                      ? selectedImages.map((img) => img.id)
                      : image
                        ? [image.id]
                        : []
                  }
                  onSelect={(ids) => {
                    if (useVideo) {
                      // Multi-select mode: update local state
                      const newImages = ids
                        .map((id) => {
                          const imgItem = imageMapping[id];
                          if (imgItem) {
                            return {
                              id: imgItem.upload_id || imgItem.id,
                              name: imgItem.name,
                              upload_id: imgItem.upload_id || imgItem.id,
                            };
                          }
                          return null;
                        })
                        .filter(
                          (
                            img
                          ): img is {
                            id: string;
                            name: string;
                            upload_id: string;
                          } => img !== null
                        );
                      setSelectedImages(newImages);
                      // Update image state with first image
                      if (newImages.length > 0 && newImages[0]) {
                        handleImageSelect(newImages[0]);
                      } else {
                        handleImageSelect(null);
                      }
                    } else {
                      // Single select mode
                      const imageId = ids[0] || null;
                      if (imageId && imageMapping[imageId]) {
                        const selectedImage = imageMapping[imageId];
                        handleImageSelect({
                          id: selectedImage.upload_id || selectedImage.id,
                          name: selectedImage.name,
                          upload_id:
                            selectedImage.upload_id || selectedImage.id,
                        });
                      } else if (!imageId) {
                        handleImageSelect(null);
                      }
                    }
                  }}
                  getId={(item) => {
                    const imgItem = item as unknown as ImageMappingItem;
                    return imgItem.id;
                  }}
                  getLabel={(item) => {
                    const imgItem = item as unknown as ImageMappingItem;
                    const date = new Date(imgItem.updated_at);
                    return `${imgItem.name} - ${date.toLocaleDateString()}`;
                  }}
                  getSearchText={(item) => {
                    const imgItem = item as unknown as ImageMappingItem;
                    const date = new Date(imgItem.updated_at);
                    return `${imgItem.name} ${date.toLocaleDateString()}`;
                  }}
                  renderButton={(selectedItems) => {
                    if (selectedItems.length === 0) {
                      return "Select image...";
                    }
                    if (useVideo && selectedItems.length > 1) {
                      return `${selectedItems.length} images selected`;
                    }
                    const selectedImage =
                      selectedItems[0] as unknown as ImageMappingItem;
                    return selectedImage?.name || "Select image...";
                  }}
                  renderItem={(item, isSelected) => {
                    const imgItem = item as unknown as ImageMappingItem;
                    const date = new Date(imgItem.updated_at);
                    return (
                      <div className="flex flex-col items-start py-3 w-full">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <Check
                              className={cn(
                                "h-4 w-4",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-medium">{imgItem.name}</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {date.toLocaleDateString()}{" "}
                          {date.toLocaleTimeString()}
                        </span>
                      </div>
                    );
                  }}
                  disabled={isReadonly}
                  multiSelect={useVideo}
                  hideSelectedChips={true}
                  buttonClassName="h-8 justify-between"
                  compact={true}
                  groupHeading="Images"
                  placeholder="Select image..."
                  clearActionLabel="New Image"
                />
              </div>
            )}

            {/* Image Grid - Horizontal Scrollable Row */}
            <div className="overflow-x-auto">
              <div className="flex gap-2 pb-2">
                {/* Display selected images */}
                {(useVideo ? selectedImages : image ? [image] : []).map(
                  (img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square w-32 min-w-[8rem] border rounded-lg overflow-hidden bg-muted/20 shrink-0"
                    >
                      {/* Preview button - top left */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewImageId(img.id);
                        }}
                        className="absolute top-1 left-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                        disabled={isReadonly}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                      </button>
                      {/* Delete button - top right */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (useVideo) {
                            // Multi-image mode: update selectedImages state
                            const newImages = selectedImages.filter(
                              (i) => i.id !== img.id
                            );
                            setSelectedImages(newImages);
                            if (newImages.length > 0 && newImages[0]) {
                              handleImageSelect(newImages[0]);
                            } else {
                              handleImageSelect(null);
                            }
                          } else {
                            // Single image mode: clear image
                            handleImageSelect(null);
                          }
                        }}
                        className="absolute top-1 right-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                        disabled={isReadonly}
                      >
                        <X className="h-3.5 w-3.5 text-primary-foreground" />
                      </button>
                      <ImageViewer
                        imageId={img.id}
                        name={img.name}
                        bare={true}
                      />
                      {/* Image name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                        <span className="truncate block">{img.name}</span>
                      </div>
                    </div>
                  )
                )}

                {/* Add Image Box - Show until max */}
                {(useVideo ? selectedImages.length : image ? 1 : 0) <
                  maxImages && (
                  <div
                    onClick={() => {
                      if (!isReadonly && !isUploadingImage) {
                        imageInputRef.current?.click();
                      }
                    }}
                    className="aspect-square w-32 min-w-[8rem] border-2 border-dashed border-muted-foreground/50 rounded-lg cursor-pointer bg-muted/20 hover:border-muted-foreground hover:bg-muted/50 transition-colors flex flex-col items-center justify-center shrink-0"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <p className="text-xs text-muted-foreground text-center px-2">
                      Add image
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Problem Statement Switch */}
        {!useProblemStatement ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="use-problem-statement"
                  className="text-sm flex items-center gap-1.5"
                >
                  <FileText
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="Problem Statement icon"
                  />
                  Problem Statement
                </Label>
                <Switch
                  id="use-problem-statement"
                  checked={useProblemStatement}
                  onCheckedChange={(checked) => {
                    onUseProblemStatementChange(checked);
                    if (!checked) {
                      onProblemStatementChange("");
                    }
                  }}
                  disabled={isReadonly}
                />
              </div>
              <p className="text-xs text-muted-foreground pl-5">
                Define the problem or scenario context
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Problem Statement Label, Switch, and Picker - Horizontal Layout */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="use-problem-statement"
                  className="text-sm flex items-center gap-1.5"
                >
                  <FileText
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="Problem Statement icon"
                  />
                  Problem Statement
                </Label>
                <Switch
                  id="use-problem-statement"
                  checked={useProblemStatement}
                  onCheckedChange={(checked) => {
                    onUseProblemStatementChange(checked);
                    if (!checked) {
                      onProblemStatementChange("");
                    }
                  }}
                  disabled={isReadonly}
                />
              </div>
              {Object.keys(problemStatementMapping).length > 0 && (
                <div className="flex items-center gap-2">
                  <GenericPicker
                    items={problemStatementMapping}
                    itemIds={Object.keys(problemStatementMapping)}
                    selectedIds={
                      selectedProblemStatementId
                        ? [selectedProblemStatementId]
                        : []
                    }
                    onSelect={(ids) => {
                      const id = ids[0] || null;
                      if (id && problemStatementMapping[id]) {
                        onProblemStatementChange(
                          problemStatementMapping[id].problem_statement
                        );
                      } else if (!id) {
                        // Clear selection - show blank problem statement
                        onProblemStatementChange("");
                      }
                    }}
                    getId={(item) => (item as unknown as { id: string }).id}
                    getLabel={(item) => {
                      const date = new Date(item.updated_at);
                      return `Version ${date.toLocaleDateString()}`;
                    }}
                    getSearchText={(item) => {
                      const date = new Date(item.updated_at);
                      const preview = item.problem_statement.substring(0, 100);
                      return `${date.toLocaleDateString()} ${preview}`;
                    }}
                    renderButton={(selectedItems) => {
                      if (selectedItems.length === 0) {
                        return "New Problem Statement";
                      }
                      const problemStatement = selectedItems[0];
                      const date = problemStatement?.updated_at
                        ? new Date(problemStatement.updated_at)
                        : new Date();
                      return `Version ${date.toLocaleDateString()}`;
                    }}
                    renderItem={(item, isSelected) => {
                      const date = new Date(item.updated_at);
                      const preview = item.problem_statement.substring(0, 100);
                      return (
                        <div className="flex flex-col items-start py-3 w-full">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-medium">
                                {date.toLocaleDateString()}{" "}
                                {date.toLocaleTimeString()}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs mt-1 line-clamp-2">
                            {preview}
                            {item.problem_statement.length > 100 ? "..." : ""}
                          </span>
                        </div>
                      );
                    }}
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="h-8 justify-between"
                    groupHeading="Version History"
                    placeholder="Select problem statement version..."
                    clearActionLabel="New Statement"
                  />
                  {hasProblemStatementChanges && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={onResetProblemStatement}
                          className="h-8 w-8 p-0"
                          data-testid="btn-reset-problem-statement"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Reset to saved problem statement</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
            {/* Textarea for problem statement input */}
            <Textarea
              id="description"
              data-testid="input-scenario-problem-statement"
              value={problemStatement || ""}
              onChange={(e) => onProblemStatementChange(e.target.value)}
              placeholder="Enter a custom problem statement or leave blank to auto-generate..."
              className="min-h-[120px]"
              disabled={isReadonly}
            />
          </div>
        )}

        {/* Objectives Switch (only when video is disabled) */}
        {!useVideo && (
          <>
            <div className="space-y-2 pt-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="objectives"
                    className="text-sm flex items-center gap-1.5"
                  >
                    <Target className="h-3.5 w-3.5 text-muted-foreground" />
                    Objectives
                  </Label>
                  <Switch
                    id="objectives"
                    checked={useObjectives}
                    onCheckedChange={(checked) => {
                      onUseObjectivesChange(checked);
                      // Objectives are cleared via onStateChange when useObjectives is false
                    }}
                    disabled={isReadonly}
                  />
                </div>
                {!useObjectives && (
                  <p className="text-xs text-muted-foreground pl-5">
                    Define specific learning objectives for the scenario
                  </p>
                )}
              </div>
            </div>

            {/* Objectives List (shown when useObjectives is true) */}
            {useObjectives && (
              <div className="space-y-2">
                {objectives.length === 0 && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={addObjective}
                      disabled={isReadonly}
                      size="sm"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Add objective
                    </Button>
                  </div>
                )}
                {objectives.map((objective, index) => (
                  <ObjectiveInputWithAutocomplete
                    key={`objective-${index}`}
                    index={index}
                    value={objective || ""}
                    onChange={(value) => updateObjective(index, value)}
                    placeholder={`Learning objective ${index + 1}`}
                    suggestions={objectivesHistory}
                    disabled={isReadonly}
                    draggedObjectiveIndex={draggedObjectiveIndex}
                    onDragStart={(e) => handleDragStartObjective(e, index)}
                    onDragOver={handleDragOverObjective}
                    onDrop={(e) => handleDropObjective(e, index)}
                    {...(objectives.length > 1 && {
                      onRemove: () => removeObjective(index),
                    })}
                    totalObjectives={objectives.length}
                    maxObjectives={3}
                  />
                ))}

                {objectives.length < 3 && objectives.length > 0 && (
                  <div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={addObjective}
                      disabled={isReadonly}
                      size="sm"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" /> Add objective
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Questions Switch (only when video is enabled) */}
        {useVideo && (
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="questions"
                  className="text-sm flex items-center gap-1.5"
                >
                  <MessageSquare
                    className="h-3.5 w-3.5 text-muted-foreground"
                    aria-label="Questions icon"
                  />
                  Questions
                </Label>
                <Switch
                  id="questions"
                  checked={useQuestions}
                  onCheckedChange={(checked) => {
                    onUseQuestionsChange(checked);
                    if (!checked) {
                      setQuestions([]);
                    }
                  }}
                  disabled={isReadonly}
                />
              </div>
              {!useQuestions && (
                <p className="text-xs text-muted-foreground pl-5">
                  Add questions below the video
                </p>
              )}
            </div>
          </div>
        )}

        {/* Questions List (when video and questions are enabled) */}
        {useVideo && useQuestions && (
          <div className="space-y-2">
            {questions.length === 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                    onClick={() => {
                    setQuestions([
                      {
                        id: "",
                        question_text: "",
                        allow_multiple: false,
                        options: [
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                        ],
                        times: [],
                      },
                    ]);
                  }}
                  disabled={isReadonly}
                  size="sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            )}
            {questions.length > 0 && (
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <div
                    key={question.id || index}
                    className={cn(
                      "space-y-2",
                      draggedQuestionIndex === index && "opacity-50"
                    )}
                    onDragOver={handleDragOverQuestion}
                    onDrop={(e) => handleDropQuestion(e, index)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Handle */}
                      {!isReadonly && (
                        <div
                          draggable={!isReadonly}
                          onDragStart={(e) => handleDragStartQuestion(e, index)}
                          className="cursor-grab active:cursor-grabbing w-8 shrink-0 flex items-center justify-center"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}

                      {/* Accordion Toggle */}
                      {question.options.length > 0 && (
                        <Button
                          type="button"
                          variant={
                            expandedQuestions.has(index) ? "default" : "outline"
                          }
                          size="icon"
                          onClick={() => toggleQuestionExpanded(index)}
                          className="h-8 w-8 shrink-0"
                          disabled={isReadonly}
                        >
                          {expandedQuestions.has(index) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronUp className="h-4 w-4" />
                          )}
                        </Button>
                      )}

                      {/* Question Text Input */}
                      <div className="flex-1 min-w-0">
                        <Input
                          ref={(el) => {
                            questionInputRefs.current[index] = el;
                          }}
                          value={question.question_text}
                          onChange={(e) =>
                            handleQuestionTextChange(index, e.target.value)
                          }
                          placeholder="Enter question text"
                          className="flex-1 w-full"
                          disabled={isReadonly}
                          onDragStart={(e) => e.preventDefault()}
                        />
                      </div>

                      {/* Time Slider */}
                      {selectedVideoLength && (
                        <div className="w-48 shrink-0">
                          <RangeSlider
                            min={0}
                            max={selectedVideoLength}
                            value={[
                              0,
                              Math.max(
                                0,
                                Math.min(
                                  selectedVideoLength,
                                  question.times?.[0] ?? 0
                                )
                              ),
                            ]}
                            onValueChange={(range) =>
                              handleQuestionTimeChange(index, range)
                            }
                            disabled={isReadonly}
                            className="space-y-0"
                          />
                        </div>
                      )}

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setQuestions(
                            questions.filter((_, i) => i !== index)
                          );
                        }}
                        className="h-8 w-8 shrink-0"
                        disabled={isReadonly}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Options (shown when expanded) */}
                    {expandedQuestions.has(index) &&
                      question.options.length > 0 && (
                        <div className="pl-10 space-y-2 border-l-2 border-muted">
                          {question.options.map((option, optIndex) => (
                            <div
                              key={option.id || optIndex}
                              className={cn(
                                "flex items-center gap-2",
                                draggedOptionIndex?.questionIndex === index &&
                                  draggedOptionIndex?.optionIndex ===
                                    optIndex &&
                                  "opacity-50"
                              )}
                              onDragOver={handleDragOverOption}
                              onDrop={(e) => handleDropOption(e, index, optIndex)}
                            >
                              {/* Option Drag Handle */}
                              <div
                                draggable={!isReadonly}
                                onDragStart={(e) =>
                                  handleDragStartOption(e, index, optIndex)
                                }
                                className="cursor-grab active:cursor-grabbing w-8 shrink-0 flex items-center justify-center"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>

                              {/* Correct Checkbox */}
                              {option.type !== "freeform" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      variant={
                                        option.is_correct
                                          ? "default"
                                          : "outline"
                                      }
                                      size="icon"
                                      onClick={() => {
                                        handleToggleOptionCorrect(
                                          index,
                                          optIndex
                                        );
                                      }}
                                      className="h-8 w-8 shrink-0"
                                      disabled={isReadonly}
                                    >
                                      <Check className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {option.is_correct
                                      ? "Mark as incorrect"
                                      : "Mark as correct"}
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              {/* Option Text Input */}
                              <Input
                                value={option.option_text}
                                onChange={(e) => {
                                  handleOptionChange(index, optIndex, {
                                    ...option,
                                    option_text: e.target.value,
                                  });
                                }}
                                placeholder="Option text"
                                className="flex-1 min-w-0"
                                style={{
                                  maxWidth:
                                    optionMaxWidths[index] !== undefined
                                      ? `${optionMaxWidths[index]}px`
                                      : undefined,
                                }}
                                disabled={isReadonly}
                                onDragStart={(e) => e.preventDefault()}
                              />

                              {/* Delete Option Button */}
                              {question.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    handleRemoveOption(index, optIndex);
                                  }}
                                  className="h-8 w-8 shrink-0"
                                  disabled={isReadonly}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          {question.options.length < 5 && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                handleAddOption(index);
                              }}
                              disabled={isReadonly}
                            >
                              <PlusCircle className="h-4 w-4 mr-2" />
                              Add Option
                            </Button>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}

            {questions.length < maxQuestions && questions.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setQuestions([
                      ...questions,
                      {
                        id: "",
                        question_text: "",
                        allow_multiple: false,
                        options: [
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                          {
                            id: "",
                            option_text: "",
                            type: "discrete",
                            is_correct: false,
                          },
                        ],
                        times: [],
                      },
                    ]);
                  }}
                  disabled={isReadonly}
                  size="sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Documents and Preview Section */}
        <div className="flex gap-4 items-stretch">
          {/* Video/Image Preview Section */}
          <div
            className={
              allPreviewDocumentIds.length > 0
                ? "w-[70%] space-y-2 flex flex-col"
                : "w-full space-y-2 flex flex-col"
            }
          >
            {/* Video Picker (when video enabled) */}
            {useVideo && (
              <>
                {Object.keys(filteredVideoMapping).length > 0 ? (
                  <div className="flex items-center justify-between">
                    <Label>Video</Label>
                    <GenericPicker
                      items={filteredVideoMapping}
                      itemIds={Object.keys(filteredVideoMapping)}
                      selectedIds={selectedVideo ? [selectedVideo.id] : []}
                      onSelect={(ids) => {
                        const videoId = ids[0] || null;
                        if (videoId && filteredVideoMapping[videoId]) {
                          const selectedVideoItem =
                            filteredVideoMapping[videoId];
                          handleVideoSelect({
                            id: selectedVideoItem.id,
                            name: selectedVideoItem.name,
                            length_seconds: selectedVideoItem.length_seconds,
                            ...(selectedVideoItem.upload_id && {
                              upload_id: selectedVideoItem.upload_id,
                            }),
                          });
                        } else if (!videoId) {
                          handleVideoSelect(null);
                        }
                      }}
                      getId={(item) => {
                        const vidItem = item as {
                          id: string;
                          name: string;
                          length_seconds: number;
                        };
                        return vidItem.id;
                      }}
                      getLabel={(item) => {
                        const vidItem = item as {
                          id: string;
                          name: string;
                          length_seconds: number;
                        };
                        return `${vidItem.name} (${Math.floor(vidItem.length_seconds / 60)}:${String(vidItem.length_seconds % 60).padStart(2, "0")})`;
                      }}
                      getSearchText={(item) => {
                        const vidItem = item as {
                          id: string;
                          name: string;
                          length_seconds: number;
                        };
                        return vidItem.name;
                      }}
                      renderButton={(selectedItems) => {
                        if (selectedItems.length === 0) {
                          return "Select video...";
                        }
                        const selectedVideoItem = selectedItems[0] as {
                          id: string;
                          name: string;
                          length_seconds: number;
                        };
                        return selectedVideoItem?.name || "Select video...";
                      }}
                      renderItem={(item, isSelected) => {
                        const vidItem = item as {
                          id: string;
                          name: string;
                          length_seconds: number;
                        };
                        return (
                          <div className="flex flex-col items-start py-3 w-full">
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    isSelected ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">
                                  {vidItem.name}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {Math.floor(vidItem.length_seconds / 60)}:
                                {String(vidItem.length_seconds % 60).padStart(
                                  2,
                                  "0"
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                      disabled={isReadonly}
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="h-8 justify-between"
                      compact={true}
                      groupHeading="Videos"
                      placeholder="Select video..."
                      clearActionLabel="No Video"
                    />
                  </div>
                ) : (
                  <Label>Video</Label>
                )}
              </>
            )}

            {!useVideo && <Label>Preview</Label>}

            {/* Video Preview Container (when video enabled) */}
            {useVideo && (
              <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1 bg-black flex items-center justify-center">
                {selectedVideo ? (
                  selectedVideo.upload_id ? (
                    <video
                      src={`/api/uploads/download/${selectedVideo.upload_id}`}
                      controls
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-white/70">
                      <Video className="h-12 w-12 mb-2" />
                      <p className="text-sm">Video upload not available</p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-white/70">
                    <Video className="h-12 w-12 mb-2" />
                    <p className="text-sm">No video selected</p>
                  </div>
                )}
              </div>
            )}

            {/* Combined Image and Chat Preview Container (when video not enabled) */}
            {!useVideo && (
              <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1">
                {/* Background Image - only show if image exists */}
                {image && (
                  <div className="absolute inset-0 w-full h-full">
                    <ImageViewer
                      imageId={image.id}
                      name={image.name}
                      bare={true}
                    />
                  </div>
                )}

                {/* Background when no image */}
                {!image && (
                  <div className="absolute inset-0 w-full h-full bg-muted/20" />
                )}

                {/* Chat Preview Overlay - always show */}
                <div className="relative z-10 p-4 h-full min-h-[400px] flex flex-col justify-start">
                  <div className="space-y-3">
                    {/* TA/User message */}
                    <div className="flex justify-end mb-3">
                      <div className="max-w-[80%]">
                        <div className="bg-primary text-primary-foreground rounded-lg p-3 shadow-lg">
                          <p className="text-sm">Hi, how can I help you?</p>
                        </div>
                      </div>
                    </div>

                    {/* Assistant messages */}
                    {selectedPersonaIds.map((personaId) => {
                      const persona = personaMapping[personaId];
                      if (!persona) return null;

                      const IconComponent =
                        getPersonaIconComponent(persona.icon || "") || MessageSquare;
                      const hexColor = persona.color || "#64748b";
                      const buttonStyle = {
                        background: generateGradientFromHex(hexColor),
                      };

                      return (
                        <div
                          key={personaId}
                          className="flex justify-start mb-3"
                        >
                          <div className="max-w-[80%] flex items-stretch gap-2">
                            <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-visible">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={persona.name || undefined}
                                    className="flex-1 p-0 rounded-md shadow-md"
                                    style={buttonStyle}
                                    tabIndex={-1}
                                  >
                                    <IconComponent className="h-4 w-4 text-white" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{persona.name}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="bg-muted/95 backdrop-blur-sm rounded-lg p-3 flex-1 shadow-lg">
                              <p className="text-sm">
                                {persona.example ||
                                  "I'd be happy to help you with that. Let me provide some guidance..."}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Show placeholder if no personas selected */}
                    {selectedPersonaIds.length === 0 && (
                      <div className="flex justify-start mb-3">
                        <div className="max-w-[80%] flex items-stretch gap-2">
                          <div className="flex flex-col gap-1 w-9 h-[26px] min-h-[26px] max-h-[26px] overflow-visible">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 p-0 rounded-md shadow-md"
                              tabIndex={-1}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="bg-muted/95 backdrop-blur-sm rounded-lg p-3 flex-1 shadow-lg">
                            <p className="text-sm text-muted-foreground italic">
                              Select personas to see preview messages
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Documents Preview Section */}
          {allPreviewDocumentIds.length > 0 && (
            <div className="w-[30%] min-w-[30%] max-w-[30%] space-y-2 flex flex-col self-stretch">
              {/* Document Navigation - Top Right */}
              {scenarioPreviewDocumentId &&
                allPreviewDocumentIds.length > 1 && (
                  <div className="flex items-center justify-between">
                    <Label>Documents</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={goToPreviousDocument}
                        disabled={currentDocumentIndex === 0 || isReadonly}
                      >
                        <span className="sr-only">Go to previous document</span>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                        {currentDocumentIndex + 1}/
                        {allPreviewDocumentIds.length}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={goToNextDocument}
                        disabled={
                          currentDocumentIndex >=
                            allPreviewDocumentIds.length - 1 || isReadonly
                        }
                      >
                        <span className="sr-only">Go to next document</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              {(!scenarioPreviewDocumentId ||
                allPreviewDocumentIds.length <= 1) && <Label>Documents</Label>}

              {/* Document Preview Container */}
              {scenarioPreviewDocumentId &&
                (() => {
                  // scenarioPreviewDocumentId should already be the child (if exists) due to allPreviewDocumentIds logic
                  // But add defensive check: if it's still a parent template, find its child
                  let previewDocId = scenarioPreviewDocumentId;
                  const previewDoc = documentDetails?.find(
                    (d) => d.document_id === previewDocId
                  );

                  // If preview doc is a template, check if we have a child for it
                  if (previewDoc?.["is_template"]) {
                    const childDoc = documentDetails?.find(
                      (d) =>
                        (d as { parent_document_id?: string })
                          ?.parent_document_id === previewDocId
                    );
                    if (childDoc) {
                      // Use child instead of parent template
                      previewDocId = childDoc.document_id;
                    }
                  }

                  const docId = previewDocId;
                  const fullDoc = documentDetails?.find(
                    (d) => d.document_id === docId
                  );
                  // Check if this is a child document (dynamic document created from template)
                  const parentDocumentId = (
                    fullDoc as {
                      parent_document_id?: string;
                    }
                  )?.parent_document_id;
                  const isChildDocument = Boolean(parentDocumentId);
                  // Derive template status from documentDetails (server data is source of truth)
                  // Child documents are NOT templates (they're the actual documents)
                  const isTemplateDocument =
                    !isChildDocument && Boolean(fullDoc?.["is_template"]);

                  const docForViewer: DocumentItem = fullDoc
                    ? ({
                        document_id: fullDoc.document_id,
                        name:
                          (fullDoc as { name?: string }).name ||
                          documentMapping[docId]?.name ||
                          "Document",
                        updated_at:
                          (fullDoc as { updated_at?: string }).updated_at ||
                          new Date().toISOString(),
                        extension:
                          (fullDoc as { extension?: string }).extension || "",
                        scenario_ids:
                          (fullDoc as { scenario_ids?: string[] })
                            .scenario_ids || [],
                        can_edit:
                          (fullDoc as { can_edit?: boolean }).can_edit || false,
                        can_delete:
                          (fullDoc as { can_delete?: boolean }).can_delete ||
                          false,
                        active:
                          (fullDoc as { active?: boolean }).active ?? true,
                        department_ids:
                          (fullDoc as { department_ids?: string[] | null })
                            .department_ids || null,
                        upload_id: fullDoc.upload_id ?? null,
                        parameter_item_ids: [],
                        field_ids: [],
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                      } as DocumentItem)
                    : ({
                        document_id: docId,
                        name: documentMapping[docId]?.name || "Document",
                        updated_at: new Date().toISOString(),
                        valid_field_ids: null,
                        active_scenario_count: null,
                        total_scenario_links: null,
                        extension: "",
                        scenario_ids: [],
                        can_edit: false,
                        can_delete: false,
                        active: true,
                        department_ids: null,
                        field_ids: [],
                        parameter_item_ids: [],
                        upload_id: null,
                      } as DocumentItem);

                  const documentName =
                    docForViewer.name ||
                    documentMapping[docId]?.name ||
                    "Document";

                  const handleDocumentDelete = () => {
                    if (isReadonly) return;
                    // Remove document from selection (updates currentDocumentIds or templateDocumentIds)
                    onDocumentRemove(docId);
                    // Handle preview switching
                    const currentIndex = allPreviewDocumentIds.indexOf(docId);
                    if (currentIndex >= 0) {
                      if (allPreviewDocumentIds.length > 1) {
                        // Switch to next document, or previous if this is the last one
                        const nextIndex =
                          currentIndex < allPreviewDocumentIds.length - 1
                            ? currentIndex + 1
                            : currentIndex - 1;
                        const nextDocId = allPreviewDocumentIds[nextIndex];
                        setScenarioPreviewDocumentId(nextDocId ?? null);
      onScenarioPreviewDocumentChange?.(nextDocId ?? null);
                      } else {
                        // Last document, clear preview
                        onScenarioPreviewDocumentChange?.(null);
                      }
                    }
                  };

                  return (
                    <div className="relative border rounded-lg overflow-hidden flex-1 min-h-[400px]">
                      {/* Preview button - top left */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewDocumentId(docId);
                        }}
                        className="absolute top-2 left-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewDocumentId(docId);
                          }
                        }}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                      {/* Delete button - top right */}
                      {!isReadonly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDocumentDelete();
                          }}
                          className="absolute top-1 right-1 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center hover:bg-primary/90 transition-colors"
                        >
                          <X className="h-3.5 w-3.5 text-primary-foreground" />
                        </button>
                      )}
                      <>
                        <div
                          className={cn(
                            "h-full overflow-auto flex items-center justify-center [&>div]:!min-h-0 [&_iframe]:!min-h-0",
                            isTemplateDocument && "opacity-20"
                          )}
                          style={{
                            // Allow horizontal scrolling for HTML documents that exceed container width
                            overflowX: "auto",
                            overflowY: "auto",
                          }}
                        >
                          <div className="w-full h-auto max-h-full">
                            <DocumentViewer
                              document={docForViewer}
                              bare={true}
                              isFormDocument={false}
                              compact={true}
                            />
                          </div>
                        </div>
                        {isTemplateDocument && (
                          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <p className="text-sm font-medium text-foreground px-4 py-2 rounded text-center">
                              Document will be automatically generated from this
                              template
                            </p>
                          </div>
                        )}
                      </>
                      {/* Document name at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 z-10">
                        <span className="truncate block">{documentName}</span>
                      </div>
                    </div>
                  );
                })()}
            </div>
          )}
        </div>

        {/* Document Preview Dialog */}
        <Dialog
          open={previewDocumentId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewDocumentId(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {previewDocumentId
                  ? documentMapping[previewDocumentId]?.name ||
                    (
                      documentDetails?.find(
                        (d) => d.document_id === previewDocumentId
                      ) as { name?: string } | undefined
                    )?.name ||
                    "Document Preview"
                  : "Document Preview"}
              </DialogTitle>
              <DialogDescription>Preview document content</DialogDescription>
            </DialogHeader>
            {previewDocumentId &&
              (() => {
                const docId = previewDocumentId;
                const fullDoc = documentDetails?.find(
                  (d) => d.document_id === docId
                );

                const docForViewer: DocumentItem = fullDoc
                  ? ({
                      document_id: fullDoc.document_id,
                      name:
                        (fullDoc as { name?: string }).name ||
                        documentMapping[docId]?.name ||
                        "Document",
                      updated_at:
                        (fullDoc as { updated_at?: string }).updated_at ||
                        new Date().toISOString(),
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                      extension:
                        (fullDoc as { extension?: string }).extension || "",
                      scenario_ids:
                        (fullDoc as { scenario_ids?: string[] }).scenario_ids ||
                        [],
                      can_edit:
                        (fullDoc as { can_edit?: boolean }).can_edit || false,
                      can_delete:
                        (fullDoc as { can_delete?: boolean }).can_delete ||
                        false,
                      active: (fullDoc as { active?: boolean }).active ?? true,
                      department_ids:
                        (fullDoc as { department_ids?: string[] | null })
                          .department_ids || null,
                      upload_id: fullDoc.upload_id ?? null,
                      parameter_item_ids: [],
                      field_ids: [],
                    } as DocumentItem)
                  : ({
                      document_id: docId,
                      name: documentMapping[docId]?.name || "Document",
                      updated_at: new Date().toISOString(),
                      extension: "",
                      scenario_ids: [],
                      can_edit: false,
                      can_delete: false,
                      active: true,
                      department_ids: null,
                      field_ids: [],
                      parameter_item_ids: [],
                      upload_id: null,
                      valid_field_ids: null,
                      active_scenario_count: null,
                      total_scenario_links: null,
                    } as DocumentItem);

                return (
                  <div className="w-full h-[calc(90vh-120px)] overflow-auto">
                    <DocumentViewer
                      document={docForViewer}
                      bare={true}
                      isFormDocument={false}
                      compact={false}
                    />
                  </div>
                );
              })()}
          </DialogContent>
        </Dialog>

        {/* Image Preview Dialog */}
        <Dialog
          open={previewImageId !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewImageId(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {previewImageId
                  ? (() => {
                      const previewImage =
                        useVideo && selectedImages.length > 0
                          ? selectedImages.find(
                              (img) => img.id === previewImageId
                            )
                          : image?.id === previewImageId
                            ? image
                            : imageMapping[previewImageId]
                              ? {
                                  id: previewImageId,
                                  name:
                                    imageMapping[previewImageId]?.name ||
                                    "Image",
                                  upload_id: previewImageId,
                                }
                              : null;
                      return previewImage?.name || "Image Preview";
                    })()
                  : "Image Preview"}
              </DialogTitle>
              <DialogDescription>Preview image content</DialogDescription>
            </DialogHeader>
            {previewImageId && (
              <div className="w-full h-[calc(90vh-120px)] overflow-auto flex items-center justify-center bg-black">
                <ImageViewer
                  imageId={previewImageId}
                  name={(() => {
                    const previewImage =
                      useVideo && selectedImages.length > 0
                        ? selectedImages.find(
                            (img) => img.id === previewImageId
                          )
                        : image?.id === previewImageId
                          ? image
                          : imageMapping[previewImageId]
                            ? {
                                id: previewImageId,
                                name:
                                  imageMapping[previewImageId]?.name || "Image",
                                upload_id: previewImageId,
                              }
                            : null;
                    return previewImage?.name || "Image";
                  })()}
                  bare={false}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
