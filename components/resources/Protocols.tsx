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
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useCallback, useMemo } from "react";

export interface ProtocolResourceItem {
  id?: string | null;
  value?: string | null;
  generated?: boolean | null;
  suggested?: boolean | null;
  pending?: boolean | null;
}

export interface ProtocolItem {
  id: string;
  value: string;
}

export interface ProtocolsProps {
  protocol_ids?: string[]; // Current protocol resource IDs (standardized prop name)
  protocol_resources?: ProtocolResourceItem[]; // Selected protocol resources (each includes generated field)
  show_protocols?: boolean; // Whether to show this resource picker
  protocols?: ProtocolResourceItem[]; // All available protocols from API (each includes generated and suggested fields)
  disabled?: boolean; // Based on can_edit flag
  onChange: (ids: string[]) => void; // Update protocol_ids in form state
  label?: string;
  id?: string;
  required?: boolean;
  placeholder?: string;
  description?: string;
  aiProtocolResources?: Array<{ id?: string | null; value?: string | null }> | null;
}

export function Protocols({
  protocol_ids,
  protocol_resources: _protocol_resources,
  show_protocols = false,
  protocols,
  disabled = false,
  onChange,
  label = "Protocols",
  id = "protocols",
  required = false,
  placeholder = "Select protocols...",
  description,
  aiProtocolResources: _aiProtocolResources,
}: ProtocolsProps) {
  const ids = useMemo(() => protocol_ids ?? [], [protocol_ids]);
  const show = show_protocols ?? false;
  const allProtocols = useMemo(() => protocols ?? [], [protocols]);

  // Pending state: items with pending=true from soft draft connections
  const pendingItems = useMemo(() => {
    return allProtocols.filter((p) => p.pending && p.id);
  }, [allProtocols]);
  const showDiff = pendingItems.length > 0;
  const pendingIds = useMemo(
    () => new Set(pendingItems.map((p) => p.id).filter(Boolean) as string[]),
    [pendingItems]
  );

  // Convert protocols array to ProtocolItem format for GenericPicker
  const protocolItems = useMemo(() => {
    return allProtocols
      .filter((p) => p.id && p.value) // Filter out nulls
      .map((p) => ({
        id: p.id!,
        value: p.value!,
      }));
  }, [allProtocols]);

  // Check if a protocol is suggested (derived from item.suggested field)
  const isSuggested = useCallback(
    (protocolId: string) => {
      const protocol = allProtocols.find((p) => p.id === protocolId);
      return protocol?.suggested === true;
    },
    [allProtocols]
  );

  const handleSelect = useCallback(
    (selectedIds: string[]) => {
      onChange(selectedIds);
    },
    [onChange]
  );

  // Accept pending — keep pending protocols in selection
  const handleAccept = useCallback(() => {
    // Pending items are already in ids (selected=true), just confirm
    // The next draft save will persist them as active
    // Nothing to change in form state — they're already included
  }, []);

  // Reject pending — remove pending protocols from selection
  const handleReject = useCallback(() => {
    const newIds = ids.filter((id) => !pendingIds.has(id));
    onChange(newIds);
  }, [ids, pendingIds, onChange]);

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
        renderItem={(item, isSelected) => {
          const isPending = pendingIds.has(item.id);

          return (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Suggested dot indicator */}
                {isSuggested(item.id) && !isSelected && !isPending && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="top">Suggested</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate">{item.value}</div>
                </div>
              </div>
              {/* Pending badge takes priority over check icon */}
              {isPending ? (
                <span className="ml-auto flex-shrink-0 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  Pending
                </span>
              ) : (
                <Check
                  className={cn(
                    "ml-auto flex-shrink-0 h-4 w-4",
                    isSelected ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
            </div>
          );
        }}
        placeholder={placeholder}
        disabled={disabled}
        showLabel={false}
        hideSelectedChips={false}
        showClearAll={true}
      />
    </div>
  );
}
