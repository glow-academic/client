/**
 * ProblemStatementAndObjectivesPicker.tsx
 * Combined component for problem statement selection and objectives input
 * Used by both Scenario.tsx and Video.tsx
 */

"use client";

import { GripVertical, PlusCircle, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProblemStatementPicker } from "./ProblemStatementPicker";

type ProblemStatementInfo = {
  problem_statement: string;
  created_at: string;
  updated_at: string;
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
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on current input value (completing the sentence)
  const filteredSuggestions = useMemo(() => {
    if (!value.trim() || !suggestions.length) return [];

    const valueLower = value.toLowerCase().trim();

    // Filter suggestions that start with or contain the typed text
    // Exclude exact matches (case-insensitive) to avoid distraction
    const matching = suggestions
      .filter((s) => {
        const sLower = s.toLowerCase().trim();
        // Skip exact matches
        if (sLower === valueLower) return false;
        // Include if starts with or contains the typed text
        return sLower.startsWith(valueLower) || sLower.includes(valueLower);
      })
      .slice(0, 5); // Show top 5 matches

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
    // Delay hiding suggestions to allow clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  return (
    <div
      className={`flex flex-col gap-2 ${
        draggedObjectiveIndex === index ? "opacity-50" : ""
      }`}
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
            onDragStart={(e) => e.preventDefault()} // Prevent dragging from input
          />
          {showSuggestions && !disabled && filteredSuggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-48 overflow-auto">
              <div className="p-1">
                {filteredSuggestions.map((suggestion, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelect(suggestion)}
                    onMouseDown={(e) => e.preventDefault()} // Prevent input blur
                    className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors"
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {totalObjectives > 1 && (
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

export interface ProblemStatementAndObjectivesPickerProps {
  // Problem statement props
  problemStatementMapping: Record<string, ProblemStatementInfo>;
  selectedProblemStatementId: string | null;
  onProblemStatementSelect: (problemStatementId: string | null) => void;
  onProblemStatementCreateNew: () => void;
  problemStatement: string;
  onProblemStatementChange: (value: string) => void;

  // Objectives props
  objectives: string[];
  onObjectivesChange: (objectives: string[]) => void;
  objectivesHistory: string[];

  // Common props
  disabled?: boolean;
  readonly?: boolean;
  entityType?: "scenario" | "video";
}

export function ProblemStatementAndObjectivesPicker({
  problemStatementMapping,
  selectedProblemStatementId,
  onProblemStatementSelect,
  onProblemStatementCreateNew,
  problemStatement,
  onProblemStatementChange,
  objectives,
  onObjectivesChange,
  objectivesHistory,
  disabled = false,
  readonly = false,
  entityType = "scenario",
}: ProblemStatementAndObjectivesPickerProps) {
  const [draggedObjectiveIndex, setDraggedObjectiveIndex] = useState<
    number | null
  >(null);

  // Objective handlers
  const addObjective = () => {
    if (objectives.length >= 3) {
      toast.error("Maximum 3 objectives allowed");
      return;
    }
    onObjectivesChange([...objectives, ""]);
  };

  const removeObjective = (index: number) => {
    onObjectivesChange(objectives.filter((_, i) => i !== index));
  };

  const updateObjective = (index: number, value: string) => {
    const newObjectives = [...objectives];
    newObjectives[index] = value;
    onObjectivesChange(newObjectives);
  };

  const handleDragStartObjective = (e: React.DragEvent, index: number) => {
    setDraggedObjectiveIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropObjective = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedObjectiveIndex === null) return;
    const newObjectives = [...objectives];
    const [removed] = newObjectives.splice(draggedObjectiveIndex, 1);
    newObjectives.splice(targetIndex, 0, removed || "");
    onObjectivesChange(newObjectives);
    setDraggedObjectiveIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Problem Statement */}
      <div className="space-y-2">
        <Label>Problem Statement</Label>
        {Object.keys(problemStatementMapping).length > 0 && (
          <ProblemStatementPicker
            problemStatementMapping={problemStatementMapping}
            selectedProblemStatementId={selectedProblemStatementId}
            onSelect={(id) => {
              onProblemStatementSelect(id);
              if (id && problemStatementMapping[id]) {
                onProblemStatementChange(
                  problemStatementMapping[id].problem_statement,
                );
              }
            }}
            onCreateNew={() => {
              onProblemStatementCreateNew();
              onProblemStatementChange("");
            }}
            disabled={disabled || readonly}
            buttonClassName="h-9"
          />
        )}
        <Textarea
          value={problemStatement || ""}
          onChange={(e) => {
            onProblemStatementChange(e.target.value);
            // Clear selected version when user manually edits
            if (selectedProblemStatementId) {
              onProblemStatementSelect(null);
            }
          }}
          placeholder={`Enter a custom ${entityType} description or leave blank to auto-generate...`}
          className="min-h-[120px]"
          disabled={disabled || readonly}
        />
      </div>

      {/* Objectives */}
      <div className="space-y-2">
        <Label>Learning Objectives</Label>
        {objectives.length === 0 && (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={addObjective}
              disabled={disabled || readonly}
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
            disabled={disabled || readonly}
            draggedObjectiveIndex={draggedObjectiveIndex}
            onDragStart={(e) => handleDragStartObjective(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDropObjective(e, index)}
            onRemove={() => removeObjective(index)}
            totalObjectives={objectives.length}
          />
        ))}
        {objectives.length < 3 && objectives.length > 0 && (
          <div>
            <Button
              type="button"
              variant="secondary"
              onClick={addObjective}
              disabled={disabled || readonly}
              size="sm"
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Add objective
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
