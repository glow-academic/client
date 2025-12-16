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
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
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
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

type PersonaMappingItem =
  components["schemas"]["app__api__v3__scenarios__detail__PersonaMappingItem"];

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

  // Objectives
  objectives: string[];
  objectivesHistory: string[];
  useObjectives: boolean;

  // Images
  useImage: boolean;
  image: { id: string; name: string; upload_id: string } | null;
  imageMapping: Record<string, ImageMappingItem>;
  isUploadingImage: boolean;

  // Videos
  useVideo: boolean;
  selectedVideo: { id: string; name: string; length_seconds: number } | null;
  videoMapping: Record<
    string,
    { id: string; name: string; length_seconds: number }
  >;
  activeVideoId: string | null;

  // Questions
  useQuestions: boolean;
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

  // Documents Preview
  allPreviewDocumentIds: string[];
  documentMapping: Record<string, DocumentMappingItem>;
  scenarioPreviewDocumentId: string | null;
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
  onObjectivesChange: (objectives: string[]) => void;
  onAddObjective: () => void;
  onRemoveObjective: (index: number) => void;
  onUpdateObjective: (index: number, value: string) => void;
  onDragStartObjective: (e: React.DragEvent, index: number) => void;
  onDragOverObjective: (e: React.DragEvent) => void;
  onDropObjective: (e: React.DragEvent, targetIndex: number) => void;
  onUseObjectivesChange: (enabled: boolean) => void;
  onUseImageChange: (enabled: boolean) => void;
  onImageSelect: (
    image: {
      id: string;
      name: string;
      upload_id: string;
    } | null
  ) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: () => void;
  onUseVideoChange: (enabled: boolean) => void;
  onVideoSelect: (
    video: { id: string; name: string; length_seconds: number } | null
  ) => void;
  onUseQuestionsChange: (enabled: boolean) => void;
  onQuestionsChange: (
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
    }>
  ) => void;
  onDragStartQuestion?: (e: React.DragEvent, index: number) => void;
  onDragOverQuestion?: (e: React.DragEvent) => void;
  onDropQuestion?: (e: React.DragEvent, targetIndex: number) => void;
  onDragStartOption?: (
    e: React.DragEvent,
    questionIndex: number,
    optionIndex: number
  ) => void;
  onDragOverOption?: (e: React.DragEvent) => void;
  onDropOption?: (
    e: React.DragEvent,
    questionIndex: number,
    targetOptionIndex: number
  ) => void;
  onUpdateQuestion?: (
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
  ) => void;
  onQuestionTimesChange?: (index: number, times: number[]) => void;
  onAddOption?: (questionIndex: number) => void;
  onRemoveOption?: (questionIndex: number, optionIndex: number) => void;
  onOptionChange?: (
    questionIndex: number,
    optionIndex: number,
    option: {
      id: string;
      option_text: string;
      type?: "discrete" | "freeform";
      is_correct: boolean;
    }
  ) => void;
  onToggleOptionCorrect?: (questionIndex: number, optionIndex: number) => void;
  onScenarioPreviewDocumentChange: (docId: string | null) => void;
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
  draggedObjectiveIndex: number | null;
  draggedQuestionIndex?: number | null;
  draggedOptionIndex?: { questionIndex: number; optionIndex: number } | null;
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
  objectives,
  objectivesHistory,
  useObjectives,
  useImage,
  image,
  imageMapping,
  isUploadingImage,
  useVideo,
  selectedVideo,
  videoMapping,
  activeVideoId: _activeVideoId,
  useQuestions,
  questions,
  currentQuestionIds: _currentQuestionIds,
  allPreviewDocumentIds,
  documentMapping,
  scenarioPreviewDocumentId,
  documentDetails,
  templateDocumentIds: _templateDocumentIds,
  selectedPersonaIds,
  personaMapping,
  onProblemStatementChange,
  onProblemStatementVersionSelect: _onProblemStatementVersionSelect,
  onResetProblemStatement,
  onObjectivesChange: _onObjectivesChange,
  onAddObjective,
  onRemoveObjective,
  onUpdateObjective,
  onDragStartObjective,
  onDragOverObjective,
  onDropObjective,
  onUseObjectivesChange,
  onUseImageChange,
  onImageSelect,
  onImageUpload,
  onImageRemove: _onImageRemove,
  onVideoSelect,
  onUseQuestionsChange,
  onQuestionsChange,
  onDragStartQuestion,
  onDragOverQuestion,
  onDropQuestion,
  onDragStartOption,
  onDragOverOption,
  onDropOption,
  onUpdateQuestion,
  onQuestionTimesChange,
  onAddOption,
  onRemoveOption,
  onOptionChange,
  onToggleOptionCorrect,
  onScenarioPreviewDocumentChange,
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
  draggedObjectiveIndex,
  draggedQuestionIndex,
  draggedOptionIndex,
  imageInputRef,
  isEditMode = false,
}: ContentSectionProps) {
  // State for document preview dialog
  const [previewDocumentId, setPreviewDocumentId] = useState<string | null>(
    null
  );

  // State for expanded questions (which questions have their options visible)
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set()
  );

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

  // Helper function to handle question time change
  const handleQuestionTimeChange = (index: number, timeStr: string) => {
    if (!onQuestionTimesChange) return;
    const time = parseInt(timeStr, 10);
    // Estimate video length from selected video or default to 8 seconds
    const estimatedVideoLength = selectedVideo?.length_seconds || 8;
    if (isNaN(time) || time < 0 || time > estimatedVideoLength) {
      return;
    }
    const newTimes = timeStr === "" ? [] : [time];
    onQuestionTimesChange(index, newTimes);
  };

  // Helper function to handle question text change
  const handleQuestionTextChange = (index: number, text: string) => {
    if (!onUpdateQuestion) {
      // Fallback to updating entire questions array
      const updatedQuestions = [...questions];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        question_text: text,
      };
      onQuestionsChange(updatedQuestions);
      return;
    }
    const currentQuestion = questions[index];
    if (!currentQuestion) return;
    onUpdateQuestion(index, {
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

  // State for document name truncation
  const documentNameRef = useRef<HTMLSpanElement>(null);
  const [isDocumentNameTruncated, setIsDocumentNameTruncated] = useState(false);

  const currentDocumentName =
    documentMapping[scenarioPreviewDocumentId || ""]?.name || "Document";

  useEffect(() => {
    const checkTruncation = () => {
      if (documentNameRef.current) {
        const isOverflowing =
          documentNameRef.current.scrollWidth >
          documentNameRef.current.clientWidth;
        setIsDocumentNameTruncated(isOverflowing);
      }
    };

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      checkTruncation();
    }, 0);

    // Recheck on window resize and when document changes
    window.addEventListener("resize", checkTruncation);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkTruncation);
    };
  }, [currentDocumentName, scenarioPreviewDocumentId]);

  const goToPreviousDocument = () => {
    if (currentDocumentIndex > 0) {
      const previousDocId = allPreviewDocumentIds[currentDocumentIndex - 1];
      onScenarioPreviewDocumentChange(previousDocId ?? null);
    }
  };

  const goToNextDocument = () => {
    if (currentDocumentIndex < allPreviewDocumentIds.length - 1) {
      const nextDocId = allPreviewDocumentIds[currentDocumentIndex + 1];
      onScenarioPreviewDocumentChange(nextDocId ?? null);
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
        {/* Problem Statement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Problem Statement</Label>
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

        {/* Objectives Switch */}
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
                  if (!checked) {
                    onObjectivesChange([]);
                  }
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
                  onClick={onAddObjective}
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
                onChange={(value) => onUpdateObjective(index, value)}
                placeholder={`Learning objective ${index + 1}`}
                suggestions={objectivesHistory}
                disabled={isReadonly}
                draggedObjectiveIndex={draggedObjectiveIndex}
                onDragStart={(e) => onDragStartObjective(e, index)}
                onDragOver={onDragOverObjective}
                onDrop={(e) => onDropObjective(e, index)}
                onRemove={
                  objectives.length > 1
                    ? () => onRemoveObjective(index)
                    : undefined
                }
                totalObjectives={objectives.length}
                maxObjectives={3}
              />
            ))}

            {objectives.length < 3 && objectives.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onAddObjective}
                  disabled={isReadonly}
                  size="sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add objective
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Documents and Preview Section */}
        <div className="flex gap-4 items-stretch">
          {/* Images Section (left column - only when both video and image are enabled) */}
          {useVideo && useImage && (
            <div className="w-[25%] min-w-[25%] max-w-[25%] space-y-2 flex flex-col self-stretch">
              <Label>Images</Label>
              {Object.keys(imageMapping).length > 0 && (
                <GenericPicker
                  items={imageMapping}
                  itemIds={Object.keys(imageMapping)}
                  selectedIds={image ? [image.id] : []}
                  onSelect={(ids) => {
                    const imageId = ids[0] || null;
                    if (imageId && imageMapping[imageId]) {
                      const selectedImage = imageMapping[imageId];
                      onImageSelect({
                        id: selectedImage.upload_id || selectedImage.id,
                        name: selectedImage.name,
                        upload_id: selectedImage.upload_id || selectedImage.id,
                      });
                    } else if (!imageId) {
                      onImageSelect(null);
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
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="h-8 justify-between"
                  compact={true}
                  groupHeading="Images"
                  placeholder="Select image..."
                  clearActionLabel="New Image"
                />
              )}
              {/* Image Upload Area */}
              <div
                onClick={() => {
                  if (!isReadonly && !isUploadingImage) {
                    imageInputRef.current?.click();
                  }
                }}
                className="relative border rounded-lg overflow-hidden min-h-[200px] flex-1 cursor-pointer bg-muted/20 border-2 border-dashed border-muted-foreground/50 hover:border-muted-foreground hover:bg-muted/50 transition-colors flex flex-col items-center justify-center"
              >
                {image ? (
                  <ImageViewer
                    imageId={image.id}
                    name={image.name}
                    bare={true}
                  />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Click to upload image
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Video/Image Preview Section */}
          <div
            className={
              useVideo && useImage
                ? allPreviewDocumentIds.length > 0
                  ? "w-[40%] space-y-2 flex flex-col"
                  : "w-[75%] space-y-2 flex flex-col"
                : allPreviewDocumentIds.length > 0
                  ? "w-[70%] space-y-2 flex flex-col"
                  : "w-full space-y-2 flex flex-col"
            }
          >
            {/* Video Picker (when video enabled) */}
            {useVideo && (
              <>
                {Object.keys(videoMapping).length > 0 ? (
                  <div className="flex items-center justify-between">
                    <Label>Video</Label>
                    <GenericPicker
                      items={videoMapping}
                      itemIds={Object.keys(videoMapping)}
                      selectedIds={selectedVideo ? [selectedVideo.id] : []}
                      onSelect={(ids) => {
                        const videoId = ids[0] || null;
                        if (videoId && videoMapping[videoId]) {
                          const selectedVideoItem = videoMapping[videoId];
                          onVideoSelect({
                            id: selectedVideoItem.id,
                            name: selectedVideoItem.name,
                            length_seconds: selectedVideoItem.length_seconds,
                          });
                        } else if (!videoId) {
                          onVideoSelect(null);
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

            {/* ImagePicker (when image enabled and video not enabled) */}
            {!useVideo && useImage && (
              <>
                {Object.keys(imageMapping).length > 0 ? (
                  <div className="flex items-center justify-between">
                    <Label>Preview</Label>
                    <GenericPicker
                      items={imageMapping}
                      itemIds={Object.keys(imageMapping)}
                      selectedIds={image ? [image.id] : []}
                      onSelect={(ids) => {
                        const imageId = ids[0] || null;
                        if (imageId && imageMapping[imageId]) {
                          const selectedImage = imageMapping[imageId];
                          onImageSelect({
                            id: selectedImage.upload_id || selectedImage.id,
                            name: selectedImage.name,
                            upload_id:
                              selectedImage.upload_id || selectedImage.id,
                          });
                        } else if (!imageId) {
                          // Clear selection - show upload UI
                          onImageSelect(null);
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
                                <span className="font-medium">
                                  {imgItem.name}
                                </span>
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
                      multiSelect={false}
                      hideSelectedChips={true}
                      buttonClassName="h-8 justify-between"
                      compact={true}
                      groupHeading="Images"
                      placeholder="Select image..."
                      clearActionLabel="New Image"
                    />
                  </div>
                ) : (
                  <Label>Preview</Label>
                )}
              </>
            )}

            {!useVideo && !useImage && <Label>Preview</Label>}

            {/* Video Preview Container (when video enabled) */}
            {useVideo && (
              <div className="relative border rounded-lg overflow-hidden min-h-[400px] flex-1 bg-black flex items-center justify-center">
                {selectedVideo ? (
                  <video
                    src={`/api/v3/videos/${selectedVideo.id}/stream`}
                    controls
                    className="w-full h-full object-contain"
                  />
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
                {/* Background Image */}
                {useImage && image && (
                  <div className="absolute inset-0 w-full h-full">
                    <ImageViewer
                      imageId={image.id}
                      name={image.name}
                      bare={true}
                    />
                  </div>
                )}

                {/* Upload Area */}
                {useImage && !image && (
                  <div
                    onClick={() => {
                      if (!isReadonly && !isUploadingImage) {
                        imageInputRef.current?.click();
                      }
                    }}
                    className="absolute inset-0 w-full h-full flex flex-col items-center justify-center cursor-pointer bg-muted/20 border-2 border-dashed border-muted-foreground/50 hover:border-muted-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground text-center px-4">
                      Click to upload image or leave blank to auto generate
                    </p>
                  </div>
                )}

                {/* Background when useImage is false */}
                {!useImage && (
                  <div className="absolute inset-0 w-full h-full bg-muted/20" />
                )}

                {/* Chat Preview Overlay */}
                {(!useImage || (useImage && image)) && (
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
                          getPersonaIconComponent(persona.icon) ||
                          MessageSquare;
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
                                      aria-label={persona.name}
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
                )}
              </div>
            )}
          </div>

          {/* Documents Preview Section */}
          {allPreviewDocumentIds.length > 0 && (
            <div
              className={
                useVideo && useImage
                  ? "w-[35%] min-w-[35%] max-w-[35%] space-y-2 flex flex-col self-stretch"
                  : "w-[30%] min-w-[30%] max-w-[30%] space-y-2 flex flex-col self-stretch"
              }
            >
              <Label>Documents</Label>

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
                        updatedAt:
                          (fullDoc as { updatedAt?: string }).updatedAt ||
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
                      } as DocumentItem)
                    : ({
                        document_id: docId,
                        name: documentMapping[docId]?.name || "Document",
                        updatedAt: new Date().toISOString(),
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
                    </div>
                  );
                })()}

              {/* Document Navigation */}
              {scenarioPreviewDocumentId &&
                allPreviewDocumentIds.length > 1 && (
                  <div className="px-4 py-2 flex items-center gap-2 bg-background">
                    {/* Left - Previous Button */}
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

                    {/* Center - Document Name + Count */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isDocumentNameTruncated ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                ref={documentNameRef}
                                className="text-sm font-medium truncate cursor-help"
                              >
                                {currentDocumentName}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">{currentDocumentName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span
                          ref={documentNameRef}
                          className="text-sm font-medium truncate"
                        >
                          {currentDocumentName}
                        </span>
                      )}
                      <span className="text-sm text-muted-foreground shrink-0 whitespace-nowrap">
                        ({currentDocumentIndex + 1}/
                        {allPreviewDocumentIds.length})
                      </span>
                    </div>

                    {/* Right - Next Button */}
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
                )}
            </div>
          )}
        </div>

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
                      onQuestionsChange([]);
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
                    onQuestionsChange([
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
                    onDragOver={onDragOverQuestion}
                    onDrop={(e) => onDropQuestion?.(e, index)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Handle */}
                      {onDragStartQuestion && (
                        <div
                          draggable={!isReadonly}
                          onDragStart={(e) => onDragStartQuestion(e, index)}
                          className="cursor-grab active:cursor-grabbing shrink-0"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}

                      {/* Question Text Input */}
                      <div className="flex-1">
                        <Input
                          value={question.question_text}
                          onChange={(e) =>
                            handleQuestionTextChange(index, e.target.value)
                          }
                          placeholder="Enter question text"
                          className="flex-1"
                          disabled={isReadonly}
                          onDragStart={(e) => e.preventDefault()}
                        />
                      </div>

                      {/* Time Input */}
                      {selectedVideo && (
                        <Input
                          type="number"
                          min="0"
                          max={selectedVideo.length_seconds}
                          value={question.times?.[0] ?? ""}
                          onChange={(e) =>
                            handleQuestionTimeChange(index, e.target.value)
                          }
                          placeholder="Time"
                          className="w-20"
                          disabled={isReadonly}
                        />
                      )}

                      {/* Accordion Toggle */}
                      {question.options.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
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

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          onQuestionsChange(
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
                        <div className="pl-6 space-y-2 border-l-2 border-muted ml-2">
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
                              onDragOver={onDragOverOption}
                              onDrop={(e) => onDropOption?.(e, index, optIndex)}
                            >
                              {/* Option Drag Handle */}
                              {onDragStartOption && (
                                <div
                                  draggable={!isReadonly}
                                  onDragStart={(e) =>
                                    onDragStartOption(e, index, optIndex)
                                  }
                                  className="cursor-grab active:cursor-grabbing shrink-0"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}

                              {/* Option Text Input */}
                              <Input
                                value={option.option_text}
                                onChange={(e) => {
                                  if (onOptionChange) {
                                    onOptionChange(index, optIndex, {
                                      ...option,
                                      option_text: e.target.value,
                                    });
                                  } else {
                                    // Fallback: update entire questions array
                                    const updatedQuestions = [...questions];
                                    const updatedOptions = [
                                      ...updatedQuestions[index].options,
                                    ];
                                    updatedOptions[optIndex] = {
                                      ...updatedOptions[optIndex],
                                      option_text: e.target.value,
                                    };
                                    updatedQuestions[index] = {
                                      ...updatedQuestions[index],
                                      options: updatedOptions,
                                    };
                                    onQuestionsChange(updatedQuestions);
                                  }
                                }}
                                placeholder="Option text"
                                className="flex-1"
                                disabled={isReadonly}
                                onDragStart={(e) => e.preventDefault()}
                              />

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
                                        if (onToggleOptionCorrect) {
                                          onToggleOptionCorrect(
                                            index,
                                            optIndex
                                          );
                                        } else {
                                          // Fallback: update entire questions array
                                          const updatedQuestions = [
                                            ...questions,
                                          ];
                                          const updatedOptions = [
                                            ...updatedQuestions[index].options,
                                          ];
                                          updatedOptions[optIndex] = {
                                            ...updatedOptions[optIndex],
                                            is_correct:
                                              !updatedOptions[optIndex]
                                                .is_correct,
                                          };
                                          updatedQuestions[index] = {
                                            ...updatedQuestions[index],
                                            options: updatedOptions,
                                          };
                                          onQuestionsChange(updatedQuestions);
                                        }
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

                              {/* Delete Option Button */}
                              {question.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (onRemoveOption) {
                                      onRemoveOption(index, optIndex);
                                    } else {
                                      // Fallback: update entire questions array
                                      const updatedQuestions = [...questions];
                                      updatedQuestions[index] = {
                                        ...updatedQuestions[index],
                                        options: updatedQuestions[
                                          index
                                        ].options.filter(
                                          (_, i) => i !== optIndex
                                        ),
                                      };
                                      onQuestionsChange(updatedQuestions);
                                    }
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
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (onAddOption) {
                                  onAddOption(index);
                                } else {
                                  // Fallback: update entire questions array
                                  const updatedQuestions = [...questions];
                                  updatedQuestions[index] = {
                                    ...updatedQuestions[index],
                                    options: [
                                      ...updatedQuestions[index].options,
                                      {
                                        id: "",
                                        option_text: "",
                                        type: "discrete",
                                        is_correct: false,
                                      },
                                    ],
                                  };
                                  onQuestionsChange(updatedQuestions);
                                }
                              }}
                              className="w-full"
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

            {questions.length < 10 && questions.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onQuestionsChange([
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

        {/* Use Image/Images Switch (at the bottom of all switches) */}
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
                {useVideo ? "Use Images" : "Use Image"}
              </Label>
              <Switch
                id="use-image"
                checked={useImage}
                onCheckedChange={(checked) => {
                  onUseImageChange(checked);
                  if (!checked) {
                    onImageSelect(null);
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
                      updatedAt:
                        (fullDoc as { updatedAt?: string }).updatedAt ||
                        new Date().toISOString(),
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
                      updatedAt: new Date().toISOString(),
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
      </CardContent>
    </Card>
  );
}
