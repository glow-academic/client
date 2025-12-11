/**
 * ContentSection.tsx
 * Scenario-specific content section component
 */
"use client";
import {
  Check,
  GripVertical,
  Image,
  Loader2,
  MessageSquare,
  PlusCircle,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import DocumentViewer, {
  type DocumentItem,
} from "@/components/common/chat/viewers/DocumentViewer";
import ImageViewer from "@/components/common/chat/viewers/ImageViewer";
import { type DocumentMappingItem } from "@/components/common/forms/DocumentPicker";
import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { RangeSlider } from "@/components/common/forms/RangeSlider";
import { Badge } from "@/components/ui/badge";
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
import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/utils";
import { getPersonaIconComponent } from "@/utils/persona-icons";

type PersonaMappingItem = components["schemas"]["PersonaMappingItem"];

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
  totalObjectives,
  objectivesEnabled,
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
  onRemove: () => void;
  totalObjectives: number;
  objectivesEnabled: boolean;
}) {
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
        {!(objectiveCount[1] > 0 && totalObjectives === 1) && (
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
  hasProblemStatementChanges: boolean;
  originalProblemStatement: string;

  // Objectives
  objectiveCountRange: { min: number; max: number };
  objectiveCount: [number, number]; // [min, max]
  onObjectiveCountChange: (min: number, max: number) => void;
  objectives: string[];
  objectivesHistory: string[];

  // Images
  useImage: boolean;
  image: { id: string; name: string; upload_id: string } | null;
  imageMapping: Record<string, ImageMappingItem>;
  isUploadingImage: boolean;

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
  imageInputRef: React.RefObject<HTMLInputElement>;
  isEditMode?: boolean;
}

export function ContentSection({
  problemStatement,
  problemStatementMapping,
  currentProblemStatementIds: _currentProblemStatementIds,
  hasProblemStatementChanges,
  originalProblemStatement: _originalProblemStatement,
  objectiveCountRange,
  objectiveCount,
  onObjectiveCountChange,
  objectives,
  objectivesHistory,
  useImage,
  image,
  imageMapping,
  isUploadingImage,
  allPreviewDocumentIds,
  documentMapping,
  scenarioPreviewDocumentId,
  documentDetails,
  templateDocumentIds,
  selectedPersonaIds,
  personaMapping,
  onProblemStatementChange,
  onProblemStatementVersionSelect: _onProblemStatementVersionSelect,
  onResetProblemStatement,
  onObjectivesChange,
  onAddObjective,
  onRemoveObjective,
  onUpdateObjective,
  onDragStartObjective,
  onDragOverObjective,
  onDropObjective,
  onUseImageChange,
  onImageSelect,
  onImageUpload,
  onImageRemove,
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
  imageInputRef,
  isEditMode = false,
}: ContentSectionProps) {
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
          <RangeSlider
            min={objectiveCountRange.min}
            max={objectiveCountRange.max}
            value={objectiveCount}
            onValueChange={([min, max]) =>
              onObjectiveCountChange(min ?? 0, max ?? 0)
            }
            disabled={isReadonly}
            className="w-[200px] mr-4"
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
            <div></div>
            {Object.keys(problemStatementMapping).length > 0 && (
              <div className="flex items-center gap-2">
                <GenericPicker
                  items={problemStatementMapping}
                  itemIds={Object.keys(problemStatementMapping)}
                  selectedIds={[]}
                  onSelect={(ids) => {
                    const id = ids[0] || null;
                    if (id && problemStatementMapping[id]) {
                      onProblemStatementChange(
                        problemStatementMapping[id].problem_statement
                      );
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
                        <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
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

        {/* Objectives List */}
        {objectiveCount[1] > 0 && (
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
                onRemove={() => onRemoveObjective(index)}
                totalObjectives={objectives.length}
                objectivesEnabled={objectiveCount[1] > 0}
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

        {/* Documents and Image Preview Section */}
        <div className="flex gap-4">
          {/* Image Preview Section */}
          <div
            className={
              allPreviewDocumentIds.length > 0
                ? "w-[70%] space-y-4"
                : "w-full space-y-4"
            }
          >
            {/* ImagePicker */}
            {useImage && Object.keys(imageMapping).length > 0 && (
              <div className="flex items-center justify-between">
                <div></div>
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
                  groupHeading="Images"
                  placeholder="Select image..."
                />
              </div>
            )}

            {/* Combined Image and Chat Preview Container */}
            <div className="relative border rounded-lg overflow-hidden min-h-[400px]">
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
                        getPersonaIconComponent(persona.icon) || MessageSquare;
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
                                I'd be happy to help you with that. Let me
                                provide some guidance...
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

              {/* Image actions overlay */}
              {useImage && image && !isReadonly && (
                <div className="absolute top-2 right-2 z-20">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onImageRemove}
                    className="h-8 w-8 p-0 bg-background/90 backdrop-blur-sm shadow-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Documents Preview Section */}
          {allPreviewDocumentIds.length > 0 && (
            <div className="w-[30%] space-y-4 flex flex-col h-[400px]">
              {/* DocumentPicker */}
              {allPreviewDocumentIds.length > 1 && (
                <GenericPicker
                  items={documentMapping}
                  itemIds={allPreviewDocumentIds}
                  selectedIds={
                    scenarioPreviewDocumentId ? [scenarioPreviewDocumentId] : []
                  }
                  onSelect={(ids) => {
                    const docId = ids[0] || null;
                    if (docId) {
                      onScenarioPreviewDocumentChange(docId);
                    }
                  }}
                  getId={(item) => {
                    const itemWithId = item as DocumentMappingItem & {
                      id: string;
                    };
                    return itemWithId.id || "";
                  }}
                  getLabel={(item) => {
                    const docItem = item as DocumentMappingItem;
                    return docItem?.name || "Document";
                  }}
                  getSearchText={(item) => {
                    const docItem = item as DocumentMappingItem;
                    return `${docItem?.name || ""} ${docItem?.description || ""}`;
                  }}
                  renderButton={(selectedItems) => {
                    if (selectedItems.length === 0) {
                      return "Select document...";
                    }
                    const selectedDoc = selectedItems[0] as DocumentMappingItem;
                    return selectedDoc?.name || "Select document...";
                  }}
                  renderItem={(item, isSelected) => {
                    const docItem = item as DocumentMappingItem;
                    const itemWithId = item as DocumentMappingItem & {
                      id: string;
                    };
                    const docId = itemWithId.id || "";
                    const isTemplateDocument =
                      templateDocumentIds.includes(docId);
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
                            <span className="font-medium">{docItem.name}</span>
                            {isTemplateDocument && (
                              <Badge variant="secondary" className="text-xs">
                                Template
                              </Badge>
                            )}
                          </div>
                        </div>
                        {docItem.description && (
                          <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {docItem.description}
                          </span>
                        )}
                      </div>
                    );
                  }}
                  disabled={isReadonly}
                  multiSelect={false}
                  hideSelectedChips={true}
                  buttonClassName="h-8 justify-between w-full"
                  groupHeading="Documents"
                  placeholder="Select document..."
                />
              )}

              {/* Document Preview Container */}
              {scenarioPreviewDocumentId && (
                <div className="relative border rounded-lg overflow-hidden flex-1 min-h-0">
                  {(() => {
                    const docId = scenarioPreviewDocumentId;
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
                            (fullDoc as { scenario_ids?: string[] })
                              .scenario_ids || [],
                          can_edit:
                            (fullDoc as { can_edit?: boolean }).can_edit ||
                            false,
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
                      <div className="h-full overflow-auto [&>div]:!min-h-0 [&>div]:h-full [&_iframe]:!min-h-0 [&_iframe]:h-full">
                        <DocumentViewer
                          document={docForViewer}
                          bare={true}
                          isFormDocument={false}
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Use Image Switch */}
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
                Use Image
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
              Use scenario background image
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
