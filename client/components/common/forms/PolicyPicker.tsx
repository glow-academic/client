/**
 * PolicyPicker.tsx
 * Used to pick policies similar to DocumentPicker
 * Supports multi-select and download functionality
 */

"use client";

import { PopoverProps } from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Download, Eye, X } from "lucide-react";
import * as React from "react";

import PolicyViewer from "@/components/common/chat/viewers/PolicyViewer";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type PolicyItem = {
  policy_id: string;
  name: string;
  type?: string;
  updatedAt?: string;
  extension?: string;
  file_path: string;
  mime_type: string;
};

export interface PolicyPickerProps<
  T extends PolicyMappingItem = PolicyMappingItem,
> extends PopoverProps {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  policyDetails?: PolicyItem[]; // Full policy objects for preview
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
  policyDetails = [],
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
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [previewPolicyId, setPreviewPolicyId] = React.useState<
    string | undefined
  >(undefined);

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

  // Handle policy preview
  const handlePreview = (policyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewPolicyId(policyId);
    setShowPreviewDialog(true);
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

  const previewPolicy = previewPolicyId
    ? mapping[previewPolicyId]
    : undefined;

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
                className="relative group border rounded-lg hover:shadow-md transition-all bg-white"
              >
                {/* Action buttons */}
                <div className="absolute top-1 right-1 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => handlePreview(id, e)}
                    className="h-5 w-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs"
                    title="Preview policy"
                  >
                    <Eye className="h-3 w-3" />
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

                {/* Policy preview - show actual PolicyViewer if details available */}
                <div className="aspect-square bg-muted rounded-lg relative overflow-hidden">
                  {(() => {
                    const fullPolicy = policyDetails.find(
                      (p) => p.policy_id === id,
                    );
                    if (fullPolicy) {
                      return (
                        <div className="w-full h-full">
                          <PolicyViewer
                            policy={fullPolicy}
                            bare={true}
                            isFormPolicy={false}
                            compact={true}
                          />
                        </div>
                      );
                    }
                    // Fallback: create minimal PolicyItem from mapping so PolicyViewer can fetch it
                    if (id) {
                      const minimalPolicy: PolicyItem = {
                        policy_id: id,
                        name: policy.name || "Policy",
                        type: policy.type || "policy",
                        updatedAt: new Date().toISOString(),
                        extension: policy.extension || "",
                        file_path: policy.filePath || "",
                        mime_type: policy.mimeType || "",
                        upload_id: policy.uploadId || null,
                      };
                      return (
                        <div className="w-full h-full">
                          <PolicyViewer
                            policy={minimalPolicy}
                            bare={true}
                            isFormPolicy={false}
                            compact={true}
                          />
                        </div>
                      );
                    }
                    // Final fallback to icon if no ID
                    return (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-4xl">
                          {getPolicyExtensionIcon(policy.extension)}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Policy name */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1">
                    <span className="truncate block">{policy.name}</span>
                  </div>
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

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl h-full max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {previewPolicy?.name || "Policy Preview"}
            </DialogTitle>
            <DialogDescription>
              {previewPolicy?.description ||
                "Preview the policy content below."}
            </DialogDescription>
          </DialogHeader>
          {previewPolicyId &&
            (() => {
              const fullPolicy = policyDetails.find(
                (p) => p.policy_id === previewPolicyId,
              );
              if (fullPolicy) {
                return (
                  <div className="flex-1 min-h-0">
                    <PolicyViewer
                      policy={fullPolicy}
                      bare={true}
                      isFormPolicy={false}
                    />
                  </div>
                );
              }
              // Fallback: try to use mapping with policy_id to fetch policy
              const mappedPolicy = mapping[previewPolicyId];
              if (mappedPolicy && previewPolicyId) {
                // Create minimal PolicyItem from mapping with policy_id
                // PolicyViewer can fetch the policy using policy_id
                const minimalPolicy: PolicyItem = {
                  policy_id: previewPolicyId,
                  name: mappedPolicy.name || "Policy",
                  type: mappedPolicy.type || "policy",
                  updatedAt: new Date().toISOString(),
                  extension: mappedPolicy.extension || "",
                  file_path: mappedPolicy.filePath || "",
                  mime_type: mappedPolicy.mimeType || "",
                };
                return (
                  <div className="flex-1 min-h-0">
                    <PolicyViewer
                      policy={minimalPolicy}
                      bare={true}
                      isFormPolicy={false}
                    />
                  </div>
                );
              }
              return null;
            })()}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

