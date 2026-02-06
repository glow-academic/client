/**
 * Protocols.tsx
 * Resource component for protocol selection
 * Uses GenericPicker to select existing protocol resources
 * Manages protocol_ids array and reports to parent
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";

type CreateDraftProtocolsIn = InputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftProtocolsOut = OutputOf<"/api/v4/resources/protocols", "post">;

export interface ProtocolItem {
  id: string;
  value: string;
}

export interface ProtocolsProps {
  protocol_ids?: string[]; // Current protocol resource IDs (standardized prop name)
  protocol_resources?: Array<{
    id: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // Selected protocol resources (each includes generated field)
  show_protocols?: boolean; // Whether to show this resource picker
  protocol_suggestions?: string[]; // Array of suggested resource IDs (UUIDs)
  protocols?: Array<{
    id: string | null;
    value: string | null;
    generated?: boolean | null;
  }>; // All available protocols from API (each includes generated field)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update protocol_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  group_id?: string | null; // Group ID for linking resources
  create_tool_id?: string | null; // Tool ID for AI generation/creation
  link_tool_id?: string | null; // Tool ID for AI link suggestions
  createProtocolsAction?:
    | ((input: CreateDraftProtocolsIn) => Promise<CreateDraftProtocolsOut>)
    | undefined;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiProtocolResources?: Array<{ id?: string | null; value?: string | null }> | null;
  onAccept?: () => void;
  onReject?: () => void;
  /** When false, skip automatic resource creation (manual save mode) */
  isAutosaveEnabled?: boolean;
  /** Register a flush callback with parent for manual save - returns created ID */
  registerFlush?: (flush: () => Promise<{ protocol_ids: string[] | null } | void>) => void;
}

export function Protocols({
  protocol_ids,
  protocol_resources,
  show_protocols = false,
  protocol_suggestions,
  protocols,
  disabled = false,
  onChange,
  label = "Protocols",
  id = "protocols",
  required = false,
  placeholder = "Select protocols...",
  description,
  group_id,
  create_tool_id,
  link_tool_id,
  createProtocolsAction,
  onGenerate,
  isGenerating = false,
  // AI diff view props
  aiProtocolResources,
  onAccept,
  onReject,
  isAutosaveEnabled = true,
  registerFlush,
}: ProtocolsProps) {
  const ids = useMemo(() => protocol_ids ?? [], [protocol_ids]);
  const show = show_protocols ?? false;
  const allProtocols = useMemo(() => protocols ?? [], [protocols]);
  const suggestionsList = useMemo(
    () => protocol_suggestions ?? [],
    [protocol_suggestions]
  );

  // Track which protocol IDs have already had resources created
  const createdProtocolIdsRef = useRef<Set<string>>(new Set());

  // Initialize createdProtocolIdsRef with current IDs
  useEffect(() => {
    ids.forEach((id) => createdProtocolIdsRef.current.add(id));
  }, [ids]);

  // Ref for flush function (stable reference for registerFlush)
  const flushRef = useRef<(() => Promise<{ protocol_ids: string[] | null } | void>) | undefined>(undefined);

  // Update flush function when dependencies change
  flushRef.current = async (): Promise<{ protocol_ids: string[] | null } | void> => {
    // Skip if no action available
    if (!createProtocolsAction || !group_id) {
      return;
    }

    // Find IDs that haven't been created yet
    const uncreatedIds = ids.filter((id) => !createdProtocolIdsRef.current.has(id));

    if (uncreatedIds.length === 0) {
      return { protocol_ids: ids };
    }

    try {
      for (const protocolId of uncreatedIds) {
        await createProtocolsAction({
          body: {
            group_id: group_id,
            protocol_id: protocolId,
            mcp: false,
          },
        });
        createdProtocolIdsRef.current.add(protocolId);
      }
      return { protocol_ids: ids };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to create protocol resources:", error);
      throw error;
    }
  };

  // Register flush callback with parent
  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => flushRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  // Convert protocols array to ProtocolItem format for GenericPicker
  const protocolItems = useMemo(() => {
    return allProtocols
      .filter((p) => p.id && p.value) // Filter out nulls
      .map((p) => ({
        id: p.id!,
        value: p.value!,
      }));
  }, [allProtocols]);

  // Check if a protocol is suggested
  const isSuggested = useCallback(
    (protocolId: string) => suggestionsList.includes(protocolId),
    [suggestionsList]
  );

  const handleSelect = useCallback(
    async (selectedIds: string[]) => {
      // Find newly selected IDs
      const newlySelected = selectedIds.filter(
        (id) => !ids.includes(id) && !createdProtocolIdsRef.current.has(id)
      );

      // Create resources for newly selected protocols - only when autosave is enabled
      if (
        isAutosaveEnabled &&
        newlySelected.length > 0 &&
        createProtocolsAction &&
        create_tool_id &&
        group_id
      ) {
        for (const protocolId of newlySelected) {
          try {
            await createProtocolsAction({
              body: {
                group_id: group_id,
                protocol_id: protocolId,
                mcp: false,
              },
            });
            createdProtocolIdsRef.current.add(protocolId);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(
              `Failed to create protocol resource for ${protocolId}:`,
              error
            );
            // Don't block UI - still update selection
          }
        }
      }

      // Update parent state
      onChange(selectedIds);
    },
    [ids, onChange, createProtocolsAction, create_tool_id, group_id, isAutosaveEnabled]
  );

  // Check if any protocol resource is generated (must be before early return)
  const hasGenerated = useMemo(() => {
    return protocol_resources?.some((p) => p.generated) ?? false;
  }, [protocol_resources]);

  // AI suggestion state
  const showDiff = !!aiProtocolResources?.length;

  // Get AI-suggested IDs (kept for potential future use)
  const _aiSuggestedIds = useMemo(
    () => new Set(aiProtocolResources?.map((r) => r.id).filter(Boolean) as string[]),
    [aiProtocolResources]
  );

  // Accept AI suggestion - add AI-suggested protocols to selection
  const handleAccept = useCallback(() => {
    if (!aiProtocolResources?.length) return;
    const newIds = aiProtocolResources
      .map((p) => p.id)
      .filter((id): id is string => !!id);
    if (newIds.length > 0) {
      onChange([...ids, ...newIds]);
    }
    onAccept?.();
  }, [aiProtocolResources, ids, onChange, onAccept]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  // Don't render if show_protocols is false (AFTER all hooks)
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
          {onGenerate && create_tool_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onGenerate}
                    disabled={disabled || isGenerating || showDiff}
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
      {/* AI-suggested protocols preview */}
      {showDiff && aiProtocolResources && aiProtocolResources.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-success">AI Suggested Protocols</p>
          <div className="space-y-2">
            {aiProtocolResources.map((item, idx) => (
              <div
                key={item.id || idx}
                className={cn(
                  "p-3 rounded-lg border-2 border-success bg-success/10",
                  "text-sm"
                )}
              >
                {item.value || ""}
              </div>
            ))}
          </div>
        </div>
      )}
      <GenericPicker<ProtocolItem>
        items={protocolItems}
        itemIds={allProtocols
          .map((p) => p.id)
          .filter((id): id is string => id !== null)} // All protocol IDs from array, filter nulls
        selectedIds={ids}
        onSelect={handleSelect}
        multiSelect={true}
        getId={(item) => item.id}
        getLabel={(item) => item.value}
        renderItem={(item, isSelected) => (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {isSuggested(item.id) && !isSelected && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded shrink-0">
                  Suggested
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.value}</div>
              </div>
            </div>
            <Check
              className={cn(
                "ml-auto flex-shrink-0 h-4 w-4",
                isSelected ? "opacity-100" : "opacity-0"
              )}
            />
          </div>
        )}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
