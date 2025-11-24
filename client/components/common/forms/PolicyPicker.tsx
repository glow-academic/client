/**
 * PolicyPicker.tsx
 * Used to pick policies similar to DocumentPicker
 * Supports multi-select and download functionality
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Download, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type MappingItem = {
  name: string;
  description: string;
};

export interface PolicyMappingItem extends MappingItem {
  extension?: string;
  filePath?: string;
  mimeType?: string;
}

export interface PolicyPickerProps<
  T extends PolicyMappingItem = PolicyMappingItem,
> extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  multiSelect?: boolean;
  label?: string;
  placeholder?: string;
  description?: string;
  hideSelectedChips?: boolean;
  disabled?: boolean;
  readonly?: boolean;
}

export function PolicyPicker<
  T extends PolicyMappingItem = PolicyMappingItem,
>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  multiSelect = false,
  label = "Policy",
  placeholder = "Select a policy...",
  description = "Choose policies that will be available for this video.",
  hideSelectedChips = false,
  disabled = false,
  readonly = false,
  ...props
}: PolicyPickerProps<T>) {
  const [open, setOpen] = React.useState(false);

  // Build policies from mapping (before filtering)
  const allPolicies = React.useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Filter policies (no tag filtering, just validIds)
  const policies = allPolicies;

  const [peekedPolicy, setPeekedPolicy] = React.useState<
    ({ id: string } & T) | undefined
  >(policies[0] as ({ id: string } & T) | undefined);

  const handleSelect = (policyId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(policyId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== policyId)
        : [...selectedIds, policyId];
      onSelect(newIds);
      // Don't close popover in multi-select mode
    } else {
      onSelect([policyId]);
      setOpen(false);
    }
  };

  // Allow clearing selection
  const handleClear = () => {
    onSelect([]);
    setOpen(false);
  };

  // Handle policy download
  const handleDownload = (policyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/policies/download/${policyId}`, "_blank");
  };

  // Remove individual item in multi-select mode
  const handleRemoveItem = (policyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter((id) => id !== policyId);
    onSelect(newIds);
  };

  const getButtonText = () => {
    if (selectedIds.length === 0) {
      return placeholder;
    }
    if (selectedIds.length === 1) {
      const policy = mapping[selectedIds[0]!];
      return policy?.name || placeholder;
    }
    return `${selectedIds.length} selected`;
  };

  const getSearchNotFoundMessage = () => {
    return `No ${label} found.`;
  };

  // Get policy extension icon
  const getPolicyExtensionIcon = (extension?: string) => {
    const ext = (extension || "").toLowerCase();
    const iconMap: Record<string, string> = {
      pdf: "📄",
      doc: "📝",
      docx: "📝",
      txt: "📄",
      other: "📋",
    };
    return iconMap[ext] || iconMap.other;
  };

  return (
    <div className="grid gap-2">
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <Label htmlFor="policy">{label}</Label>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          className="w-[260px] text-sm"
          side="left"
        >
          {description}
        </HoverCardContent>
      </HoverCard>

      {/* Show selected items in multi-select mode */}
      {multiSelect && selectedIds.length > 0 && !hideSelectedChips && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {selectedIds.map((id) => {
            const policy = mapping[id];
            if (!policy) return null;
            return (
              <div
                key={id}
                className="relative group border rounded-lg hover:shadow-md transition-all bg-white p-3"
              >
                {/* Action buttons */}
                <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handleDownload(id, e)}
                    className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                    title="Download policy"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  {!readonly && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveItem(id, e)}
                      className="h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      title="Remove policy"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Policy icon and name */}
                <div className="flex flex-col items-center justify-center min-h-[80px]">
                  <div className="text-4xl mb-2">
                    {getPolicyExtensionIcon(policy.extension)}
                  </div>
                  <div className="text-xs font-medium text-center truncate w-full">
                    {policy.name}
                  </div>
                  {policy.extension && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {policy.extension.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Popover
        open={disabled || readonly ? false : open}
        onOpenChange={disabled || readonly ? () => {} : setOpen}
        {...props}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a policy"
            className="w-full justify-between"
            disabled={disabled || readonly}
          >
            {getButtonText()}
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[400px] p-0">
          <HoverCard>
            <HoverCardContent
              side="left"
              align="start"
              forceMount
              className="min-h-[200px] w-[300px]"
            >
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">
                  {peekedPolicy?.name || "No policy selected"}
                </h4>
                <div className="text-sm text-muted-foreground">
                  {peekedPolicy?.description || "No description available"}
                </div>
                {peekedPolicy && (
                  <div className="mt-4 text-center">
                    <div className="text-6xl mb-2">
                      {getPolicyExtensionIcon(peekedPolicy.extension)}
                    </div>
                    {peekedPolicy.extension && (
                      <div className="text-xs text-muted-foreground">
                        {peekedPolicy.extension.toUpperCase()} file
                      </div>
                    )}
                  </div>
                )}
              </div>
            </HoverCardContent>
            <Command loop>
              <CommandList className="h-[var(--cmdk-list-height)] max-h-[400px]">
                <CommandInput placeholder="Search policies..." />
                <CommandEmpty>{getSearchNotFoundMessage()}</CommandEmpty>
                <HoverCardTrigger />
                {selectedIds.length > 0 && (
                  <CommandGroup heading="Actions">
                    <CommandItem
                      onSelect={handleClear}
                      className="text-muted-foreground"
                    >
                      Clear {multiSelect ? "All" : "Selection"}
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="Policies">
                  {policies.map((policy) => {
                    const isSelected = selectedIds.includes(policy.id);
                    return (
                      <CommandItem
                        key={policy.id}
                        value={policy.id}
                        onSelect={() => handleSelect(policy.id)}
                        onMouseEnter={() =>
                          setPeekedPolicy(policy as { id: string } & T)
                        }
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Check
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate">{policy.name}</span>
                          {policy.extension && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {policy.extension.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => handleDownload(policy.id, e)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </HoverCard>
        </PopoverContent>
      </Popover>
    </div>
  );
}

