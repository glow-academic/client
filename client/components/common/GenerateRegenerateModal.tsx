"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface GenerateRegenerateModalResource {
  id: string;
  label: string;
  active: boolean;
}

export interface GenerateRegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: GenerateRegenerateModalResource[];
  onResourcesChange: (
    resources: GenerateRegenerateModalResource[]
  ) => void;
  instructions: string;
  onInstructionsChange: (instructions: string) => void;
  onGenerate: (selectedResources: string[], instructions: string) => void;
  isGenerating: boolean;
  mode: "generate" | "regenerate";
  title?: string;
  description?: string;
}

export function GenerateRegenerateModal({
  open,
  onOpenChange,
  resources,
  onResourcesChange,
  instructions,
  onInstructionsChange,
  onGenerate,
  isGenerating,
  mode,
  title,
  description,
}: GenerateRegenerateModalProps) {
  const handleResourceToggle = (resourceId: string, checked: boolean) => {
    onResourcesChange(
      resources.map((r) => (r.id === resourceId ? { ...r, active: checked } : r))
    );
  };

  const handleGenerate = () => {
    const selectedResources = resources
      .filter((r) => r.active)
      .map((r) => r.id);
    
    if (selectedResources.length === 0) {
      return; // Don't generate if no resources selected
    }

    onGenerate(selectedResources, instructions.trim());
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset instructions when closing
    onInstructionsChange("");
  };

  const defaultTitle =
    mode === "generate" ? "Generate Resources" : "Regenerate Resources";
  const defaultDescription =
    mode === "generate"
      ? "Select which resources to generate and provide optional instructions."
      : "Select which resources to regenerate and provide instructions for what you'd like to change.";

  const hasSelectedResources = resources.some((r) => r.active);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
          <AlertDialogDescription className="pb-2">
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-2">
          {/* Resource Switches */}
          <div className="space-y-3">
            <Label>Resources</Label>
            <div className="space-y-2">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <Label
                    htmlFor={`resource-${resource.id}`}
                    className="flex-1 cursor-pointer font-normal"
                  >
                    {resource.label}
                  </Label>
                  <Switch
                    id={`resource-${resource.id}`}
                    checked={resource.active}
                    onCheckedChange={(checked) =>
                      handleResourceToggle(resource.id, checked)
                    }
                    disabled={isGenerating}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Instructions Textarea */}
          <div className="space-y-2">
            <Label htmlFor="modal-instructions">
              {mode === "generate" ? "Instructions (Optional)" : "Instructions"}
            </Label>
            <Textarea
              id="modal-instructions"
              value={instructions}
              onChange={(e) => onInstructionsChange(e.target.value)}
              placeholder={
                mode === "generate"
                  ? "e.g., Make it more professional, focus on empathy..."
                  : "e.g., Make it more professional, focus on empathy..."
              }
              className="min-h-[100px]"
              disabled={isGenerating}
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isGenerating}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleGenerate}
            disabled={isGenerating || !hasSelectedResources}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isGenerating
              ? mode === "generate"
                ? "Generating..."
                : "Regenerating..."
              : mode === "generate"
                ? "Generate"
                : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
