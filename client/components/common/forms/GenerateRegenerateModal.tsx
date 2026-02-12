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
import { Textarea } from "@/components/ui/textarea";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

function getGridColumns(resourceCount: number): string {
  if (resourceCount === 1) return "grid-cols-1";
  if (resourceCount === 2) return "grid-cols-2";
  if (resourceCount <= 4) return "grid-cols-2";
  if (resourceCount <= 6) return "grid-cols-3";
  return "grid-cols-3";
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
  const handleResourceToggle = (resourceId: string) => {
    onResourcesChange(
      resources.map((r) => (r.id === resourceId ? { ...r, active: !r.active } : r))
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
          {/* Resource Selection Grid */}
          <div className="space-y-3">
            <Label>Resources</Label>
            <div className={cn("grid gap-2", getGridColumns(resources.length))}>
              {resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  onClick={() => handleResourceToggle(resource.id)}
                  disabled={isGenerating}
                  className={cn(
                    "relative flex items-center justify-center rounded-md border p-3 text-sm font-medium transition-all",
                    "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    resource.active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground",
                    isGenerating && "cursor-not-allowed opacity-50"
                  )}
                >
                  {resource.active && (
                    <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-primary" />
                  )}
                  {resource.label}
                </button>
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
