import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Sparkles } from "lucide-react";

interface StepCardAiButtonProps {
  stepId: string;
  resourceTypes: string[];
  canRegenerate: (rt: string) => boolean;
  isGenerating: (rt: string) => boolean;
  onOpenModal: (stepId: string, mode: "generate" | "regenerate") => void;
  disabled?: boolean;
}

/**
 * Generate/Regenerate button for step card headers.
 * Shows a sparkles icon (or spinner when generating) with a tooltip.
 */
export function StepCardAiButton({
  stepId,
  resourceTypes,
  canRegenerate,
  isGenerating,
  onOpenModal,
  disabled,
}: StepCardAiButtonProps) {
  const hasRegeneratable = resourceTypes.some(canRegenerate);
  const isAnyGenerating = resourceTypes.some(isGenerating);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() =>
              onOpenModal(stepId, hasRegeneratable ? "regenerate" : "generate")
            }
            disabled={disabled || isAnyGenerating}
          >
            {isAnyGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {hasRegeneratable ? "Regenerate" : "Generate"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
