/**
 * DebugInfo.tsx
 * Resource component for debug info resources
 * Displays debug info resources and allows generation
 */

"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { Loader2, Sparkles } from "lucide-react";
import { useMemo } from "react";

type CreateDraftDebugInfoIn = InputOf<"/api/v4/resources/debug_info", "post">;
type CreateDraftDebugInfoOut = OutputOf<"/api/v4/resources/debug_info", "post">;

export interface DebugInfoProps {
  debug_info_ids?: string[];
  debug_info_resources?: Array<{
    debug_info_id: string | null;
    content: string | null;
    generated?: boolean | null;
  }>;
  show_debug_info?: boolean;
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  description?: string;
  group_id?: string | null;
  agent_id?: string | null;
  createDebugInfoAction?:
    | ((input: CreateDraftDebugInfoIn) => Promise<CreateDraftDebugInfoOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
}

export function DebugInfo({
  debug_info_ids,
  debug_info_resources,
  show_debug_info = false,
  disabled = false,
  onChange,
  label = "Debug Info",
  id = "debug_info",
  required = false,
  description,
  agent_id,
  onGenerate,
  isGenerating = false,
}: DebugInfoProps) {
  const show = show_debug_info ?? false;
  const hasGenerated = useMemo(() => {
    return debug_info_resources?.some((d) => d.generated) ?? false;
  }, [debug_info_resources]);

  if (!show) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
            {description && (
              <span className="text-xs text-muted-foreground ml-2">
                {description}
              </span>
            )}
          </Label>
          {onGenerate && agent_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {hasGenerated ? "Regenerate" : "Generate"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
      {debug_info_resources && debug_info_resources.length > 0 && (
        <div className="space-y-1">
          {debug_info_resources.map((debugInfo) => (
            <div
              key={debugInfo.debug_info_id || Math.random()}
              className="text-sm"
            >
              {debugInfo.content && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
                  {debugInfo.content}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
