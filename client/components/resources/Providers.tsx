/**
 * Providers.tsx
 * Resource component for provider selection
 * Uses SelectableGrid to display providers as horizontal scrollable cards
 * Manages provider_ids array and reports to parent
 */

"use client";

import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useResourceAi } from "@/hooks/use-resource-ai";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useMemo } from "react";

// Derive resource item type from the GET endpoint response
type ProvidersGetResponse = OutputOf<"/api/v5/resources/providers/get", "post">;
export type ProviderResourceItem = NonNullable<ProvidersGetResponse["items"]>[number];

export interface ProviderItem {
  id: string;
  name: string;
  description: string;
  value: string;
  endpoint: string;
}

export interface ProvidersProps {
  provider_ids?: string[];
  provider_resources?: ProviderResourceItem[];
  show_providers?: boolean;
  provider_suggestions?: string[];
  providers?: ProviderResourceItem[];
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  label?: string;
  group_id?: string | null;
  // AI diff props
  aiProviderResources?: Pick<ProviderResourceItem, "id" | "name">[] | null;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
}

export function Providers({
  provider_ids,
  provider_resources,
  show_providers = false,
  provider_suggestions,
  providers,
  disabled = false,
  onChange,
  label = "Providers",
  group_id,
  showAiGenerate = false,
  onGenerate,
}: ProvidersProps) {
  const ids = useMemo(() => provider_ids ?? [], [provider_ids]);
  const show = show_providers ?? false;
  const allProviders = useMemo(() => providers ?? [], [providers]);
  const suggestionsList = useMemo(
    () => provider_suggestions ?? [],
    [provider_suggestions]
  );

  // Socket-based AI suggestion handling via shared hook
  const { isGenerating: aiIsGenerating, aiSuggestions, clear: clearAi } = useResourceAi({
    resourceType: "providers",
    groupId: group_id,
    accumulate: true,
  });

  // AI suggestion state
  const showDiff = aiSuggestions.length > 0;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiSuggestions
          .map((p) => p.id)
          .filter(Boolean) as string[]
      ),
    [aiSuggestions]
  );

  // Convert to items format for SelectableGrid
  const providerItems = useMemo(() => {
    return allProviders
      .filter((p) => p.id)
      .map((p) => ({
        id: p.id!,
        name: p.name ?? "",
        description: p.description ?? "",
        value: p.value ?? "",
        endpoint: p.endpoint ?? "",
      }));
  }, [allProviders]);

  const isSuggested = useCallback(
    (itemId: string) => suggestionsList.includes(itemId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Check if any provider resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return provider_resources?.some((p) => p.generated) ?? false;
  }, [provider_resources]);

  // Accept AI suggestion
  const handleAccept = useCallback(() => {
    if (aiSuggestions.length === 0) return;
    const newIds = aiSuggestions
      .map((p) => p.id)
      .filter((id): id is string => !!id && !ids.includes(id));
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    clearAi();
  }, [aiSuggestions, ids, onChange, clearAi]);

  const handleReject = useCallback(() => {
    clearAi();
  }, [clearAi]);

  // Don't render if show is false (AFTER all hooks)
  if (!show) {
    return null;
  }

  return (
    <div className="space-y-4 min-w-0 w-full">
      {label && (
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-1">{label}</Label>
          {onGenerate && showAiGenerate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || aiIsGenerating || showDiff}
                  >
                    {aiIsGenerating ? (
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
          {showDiff && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-success hover:text-success"
                      onClick={handleAccept}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Accept</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={handleReject}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reject</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}

      <SelectableGrid<ProviderItem>
        items={providerItems}
        selectedId={null}
        selectedIds={ids}
        onSelect={(itemId) => {
          const newIds = ids.includes(itemId)
            ? ids.filter((id) => id !== itemId)
            : [...ids, itemId];
          handleSelect(newIds);
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col p-3 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left h-[88px]",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested &&
                  !isSelected &&
                  "ring-2 ring-success bg-success/10"
              )}
            >
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-5 w-5 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              {isSuggested(item.id) && !isSelected && !isAiSuggested && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded">
                  Suggested
                </div>
              )}
              <div className="flex flex-col justify-center gap-1 flex-1 overflow-hidden">
                <span className="text-sm font-medium truncate">
                  {item.name || "Unnamed"}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {item.value || item.endpoint || "No details"}
                </span>
              </div>
            </div>
          );
        }}
        emptyMessage="No providers available."
        disabled={disabled}
        horizontal
      />
    </div>
  );
}
