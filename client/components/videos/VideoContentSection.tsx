/**
 * VideoContentSection.tsx
 * Video-specific content section component
 */
"use client";
import {
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Image,
  Loader2,
  PlusCircle,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "active" | "completed";

// Question types
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

export interface ImageMappingItem {
  id: string;
  name: string;
  upload_id?: string;
  file_path?: string;
  mime_type?: string;
  created_at: string;
  updated_at: string;
}

export interface VideoContentSectionProps {
  // Outline
  outline: string;
  outlineMapping: Record<
    string,
    { outline: string; created_at: string; updated_at: string }
  >;
  currentOutlineIds: string[];
  hasOutlineChanges: boolean;
  originalOutline: string;

  // Questions
  questionCountRange: { min: number; max: number };
  questionCount: [number, number]; // [min, max]
  onQuestionCountChange: (min: number, max: number) => void;
  questions: Question[];

  // Images
  useImage: boolean;
  images: Array<{
    id: string;
    name: string;
    mime_type: string;
    upload_id?: string;
    file_path?: string;
  }>;
  imageMapping: Record<string, ImageMappingItem>;
  isUploadingImage: boolean;

  // Documents Preview
  allPreviewDocumentIds: string[];
  documentMapping: Record<string, DocumentMappingItem>;
  videoPreviewDocumentId: string | null;
  documentDetails?: Array<{ document_id: string; [key: string]: unknown }>;

  // Video
  generatedVideoUrl: string | null;
  uploadedVideoFile: File | null;
  videoObjectUrl: string | null;
  isUploadingVideo: boolean;
  isGeneratingVideo: boolean;
  isGeneratingOutline: boolean;

  // Callbacks
  onOutlineChange: (value: string) => void;
  onOutlineVersionSelect: (id: string) => void;
  onResetOutline: () => void;
  onQuestionsChange: (questions: Question[]) => void;
  onAddQuestion: () => void;
  onRemoveQuestion: (index: number) => void;
  onUpdateQuestion: (index: number, question: Question) => void;
  onQuestionTimesChange: (index: number, times: number[]) => void;
  onOptionChange: (
    questionIndex: number,
    optionIndex: number,
    option: QuestionOption
  ) => void;
  onAddOption: (questionIndex: number) => void;
  onRemoveOption: (questionIndex: number, optionIndex: number) => void;
  onToggleOptionCorrect: (questionIndex: number, optionIndex: number) => void;
  onUseImageChange: (enabled: boolean) => void;
  onImageSelect: (imageId: string | null) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: (index: number) => void;
  onVideoPreviewDocumentChange: (docId: string | null) => void;
  onGenerate: () => void;
  onResetContent: () => void;
  onDragStartQuestion: (e: React.DragEvent, index: number) => void;
  onDragOverQuestion: (e: React.DragEvent) => void;
  onDropQuestion: (e: React.DragEvent, targetIndex: number) => void;
  onDragStartOption: (
    e: React.DragEvent,
    questionIndex: number,
    optionIndex: number
  ) => void;
  onDragOverOption: (e: React.DragEvent) => void;
  onDropOption: (
    e: React.DragEvent,
    questionIndex: number,
    targetOptionIndex: number
  ) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
  isSubmitting: boolean;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  draggedQuestionIndex: number | null;
  draggedOptionIndex: { questionIndex: number; optionIndex: number } | null;
}

export function VideoContentSection({
  outline,
  outlineMapping,
  currentOutlineIds: _currentOutlineIds,
  hasOutlineChanges,
  originalOutline: _originalOutline,
  questionCountRange,
  questionCount,
  onQuestionCountChange,
  questions,
  useImage,
  images,
  imageMapping: _imageMapping,
  isUploadingImage,
  allPreviewDocumentIds,
  documentMapping,
  videoPreviewDocumentId,
  documentDetails,
  generatedVideoUrl,
  uploadedVideoFile,
  videoObjectUrl,
  isUploadingVideo,
  isGeneratingVideo,
  onOutlineChange,
  onOutlineVersionSelect,
  onResetOutline,
  onQuestionsChange: _onQuestionsChange,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateQuestion,
  onQuestionTimesChange,
  onOptionChange,
  onAddOption,
  onRemoveOption,
  onToggleOptionCorrect,
  onUseImageChange,
  onImageSelect: _onImageSelect,
  onImageUpload,
  onImageRemove,
  onVideoPreviewDocumentChange,
  onGenerate,
  onResetContent,
  onDragStartQuestion,
  onDragOverQuestion,
  onDropQuestion,
  onDragStartOption,
  onDragOverOption,
  onDropOption,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
  isSubmitting,
  imageInputRef,
  videoRef,
  draggedQuestionIndex,
  draggedOptionIndex,
}: VideoContentSectionProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set()
  );

  // Video length picker component

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

  const handleQuestionTimeChange = (index: number, timeStr: string) => {
    const time = parseInt(timeStr, 10);
    // Approximate video length from question count: max questions = floor(length/4)+1, so length ≈ (max-1)*4
    const estimatedVideoLength =
      questionCount[1] > 0 ? (questionCount[1] - 1) * 4 : 8;
    if (isNaN(time) || time < 0 || time > estimatedVideoLength) {
      return;
    }
    const currentQuestion = questions[index];
    if (!currentQuestion) return;

    const newTimes = timeStr === "" ? [] : [time];
    onQuestionTimesChange(index, newTimes);
  };

  const handleQuestionTextChange = (index: number, text: string) => {
    const currentQuestion = questions[index];
    if (!currentQuestion) return;
    onUpdateQuestion(index, {
      ...currentQuestion,
      question_text: text,
    });
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" ? "ring-2 ring-primary" : "",
        stepStatus === "pending" ? "opacity-50" : ""
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
              stepNumber
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RangeSlider
            min={questionCountRange.min}
            max={questionCountRange.max}
            value={questionCount}
            onValueChange={([min, max]) =>
              onQuestionCountChange(min ?? 0, max ?? 0)
            }
            disabled={isReadonly}
            className="w-[200px] mr-4"
          />
          <Button
            variant="default"
            size="sm"
            onClick={onGenerate}
            disabled={
              isSubmitting ||
              isGeneratingVideo ||
              isGeneratingOutline ||
              isReadonly
            }
          >
            {isGeneratingVideo || isGeneratingOutline ? (
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
        {/* Outline Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Outline</Label>
            {Object.keys(outlineMapping).length > 0 && (
              <div className="flex items-center gap-2">
                <GenericPicker
                  items={outlineMapping}
                  itemIds={Object.keys(outlineMapping)}
                  selectedIds={[]}
                  onSelect={(ids) => {
                    const id = ids[0] || null;
                    if (id && outlineMapping[id]) {
                      onOutlineChange(outlineMapping[id].outline);
                      onOutlineVersionSelect(id);
                    }
                  }}
                  getId={(item) => (item as unknown as { id: string }).id}
                  getLabel={(item) => {
                    const date = new Date(item.updated_at);
                    return `Version ${date.toLocaleDateString()}`;
                  }}
                  getSearchText={(item) => {
                    const date = new Date(item.updated_at);
                    const preview = item.outline.substring(0, 100);
                    return `${date.toLocaleDateString()} ${preview}`;
                  }}
                  renderButton={(selectedItems) => {
                    if (selectedItems.length === 0) {
                      return "New Outline";
                    }
                    const outlineItem = selectedItems[0];
                    const date = outlineItem?.updated_at
                      ? new Date(outlineItem.updated_at)
                      : new Date();
                    return `Version ${date.toLocaleDateString()}`;
                  }}
                  renderItem={(item, isSelected) => {
                    const date = new Date(item.updated_at);
                    const preview = item.outline.substring(0, 100);
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
                        <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {preview}
                          {item.outline.length > 100 ? "..." : ""}
                        </span>
                      </div>
                    );
                  }}
                  disabled={isReadonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="h-8 justify-between"
                  groupHeading="Version History"
                  placeholder="Select outline version..."
                />
                {hasOutlineChanges && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={onResetOutline}
                        className="h-8 w-8 p-0"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset to saved outline</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
          <Textarea
            value={outline || ""}
            onChange={(e) => onOutlineChange(e.target.value)}
            placeholder="Enter video outline or generate one from policies and questions..."
            className="min-h-[120px]"
            disabled={isReadonly}
          />
        </div>

        {/* Questions List */}
        {questionCount[1] > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label>
                Questions ({questions.length}/{questionCount[1]})
              </Label>
            </div>
            {questions.length > 0 && (
              <div className="space-y-2">
                {questions.map((question, index) => (
                  <div
                    key={question.question_id || index}
                    className={cn(
                      "p-3 space-y-2",
                      draggedQuestionIndex === index && "opacity-50"
                    )}
                    onDragOver={onDragOverQuestion}
                    onDrop={(e) => onDropQuestion(e, index)}
                  >
                    <div className="flex items-center gap-2">
                      {/* Drag Handle */}
                      <div
                        draggable={!isReadonly}
                        onDragStart={(e) => onDragStartQuestion(e, index)}
                        className="cursor-grab active:cursor-grabbing shrink-0"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>

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
                      <Input
                        type="number"
                        min="0"
                        max={
                          questionCount[1] > 0 ? (questionCount[1] - 1) * 4 : 8
                        }
                        value={question.times[0] ?? ""}
                        onChange={(e) =>
                          handleQuestionTimeChange(index, e.target.value)
                        }
                        placeholder="Time"
                        className="w-20"
                        disabled={isReadonly}
                      />

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
                        onClick={() => onRemoveQuestion(index)}
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
                              key={option.option_id || optIndex}
                              className={cn(
                                "flex items-center gap-2",
                                draggedOptionIndex?.questionIndex === index &&
                                  draggedOptionIndex?.optionIndex ===
                                    optIndex &&
                                  "opacity-50"
                              )}
                              onDragOver={onDragOverOption}
                              onDrop={(e) => onDropOption(e, index, optIndex)}
                            >
                              {/* Option Drag Handle */}
                              <div
                                draggable={!isReadonly}
                                onDragStart={(e) =>
                                  onDragStartOption(e, index, optIndex)
                                }
                                className="cursor-grab active:cursor-grabbing shrink-0"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </div>

                              {/* Option Text Input */}
                              <Input
                                value={option.option_text}
                                onChange={(e) =>
                                  onOptionChange(index, optIndex, {
                                    ...option,
                                    option_text: e.target.value,
                                  })
                                }
                                placeholder="Option text"
                                className="flex-1"
                                disabled={isReadonly}
                                onDragStart={(e) => e.preventDefault()}
                              />

                              {/* Correct Checkbox */}
                              {option.type === "discrete" && (
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
                                      onClick={() =>
                                        onToggleOptionCorrect(index, optIndex)
                                      }
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
                                  onClick={() =>
                                    onRemoveOption(index, optIndex)
                                  }
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
                              onClick={() => onAddOption(index)}
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
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onAddQuestion}
                disabled={isReadonly || questions.length >= questionCount[1]}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </div>
          </div>
        )}

        {/* Use Image Switch */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="use-image"
              className="text-sm flex items-center gap-1.5"
            >
              <Image className="h-3.5 w-3.5 text-muted-foreground" />
              Use Images
            </Label>
            <Switch
              id="use-image"
              checked={useImage}
              onCheckedChange={onUseImageChange}
              disabled={isReadonly}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Use video reference images
          </p>
        </div>

        {/* Three-Column Layout: Images | Video | Documents */}
        <div className="flex gap-4">
          {/* Images Column (Left) */}
          {useImage && (
            <div className="w-48 space-y-2 flex-shrink-0">
              <Label>Images</Label>
              {images.length > 0 ? (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {images.map((img, idx) => (
                    <div key={img.id || idx} className="relative">
                      <img
                        src={
                          img.file_path ||
                          `/api/v3/uploads/download/${img.upload_id || img.id}`
                        }
                        alt={img.name}
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onImageRemove(idx)}
                        className="absolute top-1 right-1 h-6 w-6 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isReadonly}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => {
                    if (!isReadonly && !isUploadingImage) {
                      imageInputRef.current?.click();
                    }
                  }}
                  className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">
                    Click to upload
                  </p>
                </div>
              )}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onImageUpload}
                disabled={isReadonly || isUploadingImage}
                className="hidden"
              />
            </div>
          )}

          {/* Video Column (Center) */}
          <div className="flex-1 space-y-2">
            <Label>Video</Label>
            {isUploadingVideo ? (
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm">Uploading video...</p>
                </div>
              </div>
            ) : generatedVideoUrl || (videoObjectUrl && uploadedVideoFile) ? (
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative">
                <video
                  ref={videoRef}
                  src={generatedVideoUrl || videoObjectUrl || undefined}
                  controls
                  className="w-full h-full rounded-lg"
                />
              </div>
            ) : (
              <div className="w-full bg-black rounded-lg aspect-video flex items-center justify-center relative border-2 border-dashed border-muted-foreground/25">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-12 w-12" />
                  <p className="text-sm">No video</p>
                </div>
              </div>
            )}
          </div>

          {/* Documents Column (Right) */}
          {allPreviewDocumentIds.length > 0 && (
            <div className="w-80 space-y-2 flex-shrink-0">
              <Label>Documents</Label>
              <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto">
                {allPreviewDocumentIds.map((docId) => {
                  const doc = documentMapping[docId];
                  if (!doc) return null;
                  return (
                    <div
                      key={docId}
                      className={cn(
                        "p-3 cursor-pointer hover:bg-muted transition-colors border-b last:border-b-0",
                        videoPreviewDocumentId === docId && "bg-muted"
                      )}
                      onClick={() =>
                        onVideoPreviewDocumentChange(
                          videoPreviewDocumentId === docId ? null : docId
                        )
                      }
                    >
                      <div className="font-medium text-sm">{doc.name}</div>
                    </div>
                  );
                })}
              </div>
              {videoPreviewDocumentId &&
                (() => {
                  const previewDoc = documentDetails?.find(
                    (d) => d.document_id === videoPreviewDocumentId
                  );
                  return previewDoc ? (
                    <div className="border rounded-lg p-4">
                      <DocumentViewer document={previewDoc as DocumentItem} />
                    </div>
                  ) : null;
                })()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
