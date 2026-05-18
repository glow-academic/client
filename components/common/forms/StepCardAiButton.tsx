import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Loader2, Sparkles, X } from "lucide-react";

interface StepCardAiButtonProps {
  stepId: string;
  resourceTypes: string[];
  canRegenerate: (rt: string) => boolean;
  isGenerating: (rt: string) => boolean;
  onOpenModal: (stepId: string, mode: "generate" | "regenerate") => void;
  disabled?: boolean;
  hasPending?: boolean;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

/**
 * Generate/Regenerate button for step card headers.
 * When pending items exist, shows accept/reject all instead of generate.
 */
export function StepCardAiButton({
  stepId,
  resourceTypes,
  canRegenerate,
  isGenerating,
  onOpenModal,
  disabled,
  hasPending = false,
  onAcceptAll,
  onRejectAll,
}: StepCardAiButtonProps) {
  const hasRegeneratable = resourceTypes.some(canRegenerate);
  const isAnyGenerating = resourceTypes.some(isGenerating);

  // Pending mode: show accept/reject all instead of generate
  if (hasPending && onAcceptAll && onRejectAll) {
    return (
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-success hover:text-success"
                onClick={onAcceptAll}
                disabled={disabled}
              >
                <Check className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept all</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={onRejectAll}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject all</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // Normal mode: generate/regenerate button
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
