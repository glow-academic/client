/**
 * PersonaContentSection.tsx
 * Content section for Persona form with instructions and example messages
 */
"use client";

import React, { useMemo, useRef, useState } from "react";
import { Check, GripVertical, PlusCircle, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Component for example input with autocomplete
function ExampleInputWithAutocomplete({
  index,
  value,
  onChange,
  placeholder,
  suggestions,
  disabled,
  draggedExampleIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  totalExamples,
}: {
  index: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  disabled: boolean;
  draggedExampleIndex: number | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onRemove: () => void;
  totalExamples: number;
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
      className={cn(
        "flex flex-col gap-2",
        draggedExampleIndex === index && "opacity-50",
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
        {totalExamples > 1 && (
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

export interface PersonaContentSectionProps {
  instructions: string;
  onInstructionsChange: (instructions: string) => void;
  exampleMessages: string[];
  onExampleMessagesChange: (messages: string[]) => void;
  examplesHistory: string[];
  stepStatus: "pending" | "active" | "completed";
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly: boolean;
}

export function PersonaContentSection({
  instructions,
  onInstructionsChange,
  exampleMessages,
  onExampleMessagesChange,
  examplesHistory,
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isReadonly,
}: PersonaContentSectionProps) {
  const [draggedExampleIndex, setDraggedExampleIndex] = useState<number | null>(
    null,
  );

  const addExample = () => {
    if (exampleMessages.length >= 10) {
      return;
    }
    onExampleMessagesChange([...exampleMessages, ""]);
  };

  const removeExample = (index: number) => {
    onExampleMessagesChange(exampleMessages.filter((_, i) => i !== index));
  };

  const updateExample = (index: number, value: string) => {
    const newExamples = [...exampleMessages];
    newExamples[index] = value;
    onExampleMessagesChange(newExamples);
  };

  const handleDragStartExample = (e: React.DragEvent, index: number) => {
    setDraggedExampleIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOverExample = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropExample = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedExampleIndex === null) return;
    const newExamples = [...exampleMessages];
    const [removed] = newExamples.splice(draggedExampleIndex, 1);
    newExamples.splice(targetIndex, 0, removed || "");
    onExampleMessagesChange(newExamples);
    setDraggedExampleIndex(null);
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              <span>{stepNumber}</span>
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions */}
        <div className="space-y-2">
          <Label htmlFor="instructions">Instructions *</Label>
          <Textarea
            id="instructions"
            data-testid="input-instructions"
            value={instructions}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder="Instructions that define how the persona should behave and respond."
            rows={8}
            required
            disabled={isReadonly}
          />
          <p className="text-xs text-muted-foreground">
            Define the persona's behavior, communication style, and response
            patterns
          </p>
        </div>

        {/* Examples Section */}
        <div className="space-y-2 pt-2">
          <Label className="text-sm">Example Messages</Label>
          <p className="text-xs text-muted-foreground">
            Add example messages to guide the persona's communication style
          </p>
          <div className="space-y-2">
            {exampleMessages.length === 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addExample}
                  disabled={isReadonly}
                  size="sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add example
                </Button>
              </div>
            )}
            {exampleMessages.map((example, index) => (
              <ExampleInputWithAutocomplete
                key={`example-${index}`}
                index={index}
                value={example || ""}
                onChange={(value) => updateExample(index, value)}
                placeholder={`Example message ${index + 1}`}
                suggestions={examplesHistory}
                disabled={isReadonly}
                draggedExampleIndex={draggedExampleIndex}
                onDragStart={(e) => handleDragStartExample(e, index)}
                onDragOver={handleDragOverExample}
                onDrop={(e) => handleDropExample(e, index)}
                onRemove={() => removeExample(index)}
                totalExamples={exampleMessages.length}
              />
            ))}

            {exampleMessages.length < 10 && exampleMessages.length > 0 && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addExample}
                  disabled={isReadonly}
                  size="sm"
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add example
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
