/**
 * KeyPicker.tsx
 * Picker for selecting API keys with masked preview and create functionality
 */
"use client";

import { Check, ChevronsUpDown, Eye, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CreateKeyIn,
  CreateKeyOut,
} from "@/app/(main)/system/authentication/page";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type KeyMappingItem = {
  key_masked: string;
  active: boolean;
};

export interface KeyPickerProps<T extends KeyMappingItem = KeyMappingItem> {
  mapping: Record<string, T>;
  validIds: string[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  disabled?: boolean;
  /** Enable multi-select mode with badge display */
  multiSelect?: boolean;
  /** Where to render the selected badges relative to the button */
  badgesPosition?: "above" | "below";
  /** Show a Clear All button when items are selected */
  showClearAll?: boolean;
  /** Hide the selected badges (for compact display) */
  hideSelectedChips?: boolean;
  /** Compact mode - smaller button, no label */
  compact?: boolean;
  /** Custom button className */
  buttonClassName?: string;
  /** Show required indicator */
  required?: boolean;
  /** Server action for creating keys */
  createKeyAction?: (input: CreateKeyIn) => Promise<CreateKeyOut>;
  /** Key type filter (default: 'auth') */
  keyType?: string;
}

export function KeyPicker<T extends KeyMappingItem = KeyMappingItem>({
  mapping,
  validIds,
  selectedIds,
  onSelect,
  disabled = false,
  multiSelect = false,
  badgesPosition = "below",
  showClearAll = false,
  hideSelectedChips = false,
  compact = false,
  buttonClassName,
  required = false,
  createKeyAction,
  keyType = "auth",
}: KeyPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newKeyActive, setNewKeyActive] = useState(true);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [previewKeyFull, setPreviewKeyFull] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Build keys from mapping
  const keys = useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Filter keys by search
  const filteredKeys = useMemo(() => {
    if (!search.trim()) return keys;
    const searchLower = search.toLowerCase();
    return keys.filter((key) => {
      const masked = key.key_masked?.toLowerCase() || "";
      return masked.includes(searchLower);
    });
  }, [keys, search]);

  const handleKeySelect = (keyId: string) => {
    if (multiSelect) {
      const isSelected = selectedIds.includes(keyId);
      const newIds = isSelected
        ? selectedIds.filter((id) => id !== keyId)
        : [...selectedIds, keyId];
      onSelect(newIds);
    } else {
      onSelect([keyId]);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelect([]);
    if (!multiSelect) {
      setOpen(false);
    }
  };

  const handleRemoveItem = (keyId: string) => {
    onSelect(selectedIds.filter((id) => id !== keyId));
  };

  const getButtonText = () => {
    const requiredIndicator = required ? " *" : "";
    if (selectedIds.length === 0) {
      return `Select key${requiredIndicator}`;
    }
    if (multiSelect) {
      if (compact) {
        const masked = selectedIds
          .map((id) => mapping[id]?.key_masked)
          .filter(Boolean) as string[];
        if (masked.length === 0) {
          return `${selectedIds.length} keys selected${requiredIndicator}`;
        }
        return masked.join(", ") + requiredIndicator;
      }
      return `${selectedIds.length} keys selected${requiredIndicator}`;
    }
    return (
      (mapping[selectedIds[0]!]?.key_masked ||
        `Select key${requiredIndicator}`) + requiredIndicator
    );
  };

  const handleCreate = async () => {
    if (!newKey.trim()) {
      toast.error("Key value is required");
      return;
    }

    if (!createKeyAction) {
      toast.error("Create action is not available");
      return;
    }

    try {
      setIsCreating(true);
      const created = await createKeyAction({
        body: {
          key: newKey.trim(),
          type: keyType,
          active: newKeyActive,
        },
      });

      toast.success("Key created successfully");
      setShowCreateDialog(false);
      setNewKey("");
      setNewKeyActive(true);
      if (!multiSelect) {
        setOpen(false);
      }
      // Refresh to get updated key list
      router.refresh();
      // Add to selection
      if (multiSelect && created.keyId) {
        onSelect([...selectedIds, created.keyId]);
      } else if (created.keyId) {
        onSelect([created.keyId]);
      }
    } catch (error) {
      toast.error("Failed to create key", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handlePreview = async (keyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowPreviewDialog(true);
    setPreviewKeyFull(null);

    // Fetch full key immediately
    setIsLoadingPreview(true);
    try {
      const response = await api.post("/keys/detail", {
        body: { keyId, show_full: true },
      });
      setPreviewKeyFull(response.key);
    } catch {
      toast.error("Failed to load key details");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCopyKey = () => {
    if (previewKeyFull) {
      navigator.clipboard.writeText(previewKeyFull);
      toast.success("Key copied to clipboard");
    }
  };

  // Badge display for multi-select mode
  const Badges = (
    <div className="flex flex-wrap gap-1">
      {selectedIds.map((id) => {
        const key = mapping[id];
        if (!key) return null;
        return (
          <Badge
            key={id}
            variant="secondary"
            className="flex items-center gap-1"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePreview(id, e);
              }}
              className="inline-flex items-center hover:opacity-70"
              disabled={disabled}
              aria-label="Preview key"
            >
              <Eye className="h-3 w-3" />
            </button>
            <span className="truncate max-w-[200px]">{key.key_masked}</span>
            <button
              type="button"
              aria-label={`Remove ${key.key_masked}`}
              onClick={() => handleRemoveItem(id)}
              className="inline-flex items-center"
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        );
      })}
    </div>
  );

  return (
    <div className={compact ? "" : "grid gap-2"}>
      {/* Show badges above button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        selectedIds.length > 0 &&
        badgesPosition === "above" && <div className="mb-2">{Badges}</div>}

      <Popover
        open={disabled ? false : open}
        onOpenChange={disabled ? () => {} : setOpen}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select key"
            className={cn(
              compact
                ? "h-7 px-2 text-xs justify-between w-full"
                : "w-full justify-between",
              buttonClassName
            )}
            size={compact ? "sm" : "default"}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selectedIds.length > 0 && !multiSelect && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(selectedIds[0]!);
                  }}
                  className="inline-flex items-center hover:opacity-70 flex-shrink-0"
                  disabled={disabled}
                  aria-label="Preview key"
                >
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              )}
              <span className="truncate">{getButtonText()}</span>
            </div>
            <ChevronsUpDown
              className={compact ? "h-3 w-3 opacity-50" : "opacity-50"}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[360px] p-0">
          <Command>
            <CommandInput
              placeholder="Search keys..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No keys found.</CommandEmpty>
            <CommandList className="max-h-[400px]">
              <CommandGroup heading="Keys">
                {selectedIds.length > 0 && (
                  <CommandItem
                    onSelect={handleClear}
                    className="text-muted-foreground"
                  >
                    Clear {multiSelect ? "All" : "Selection"}
                  </CommandItem>
                )}
                {createKeyAction && (
                  <CommandItem
                    onSelect={() => {
                      setShowCreateDialog(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Key
                  </CommandItem>
                )}
                {filteredKeys.map((key) => (
                  <CommandItem
                    key={key.id}
                    onSelect={() => handleKeySelect(key.id)}
                    value={key.key_masked || ""}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePreview(key.id, e);
                        }}
                        className="inline-flex items-center hover:opacity-70 flex-shrink-0"
                        aria-label="Preview key"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="truncate">{key.key_masked}</div>
                        {!key.active && (
                          <div className="text-xs text-muted-foreground">
                            Inactive
                          </div>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto",
                          selectedIds.includes(key.id)
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Show badges below button if configured */}
      {multiSelect &&
        !hideSelectedChips &&
        !compact &&
        selectedIds.length > 0 &&
        badgesPosition === "below" && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1">{Badges}</div>
            {showClearAll && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={disabled}
              >
                Clear All
              </Button>
            )}
          </div>
        )}

      {/* Create key dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Key</DialogTitle>
            <DialogDescription>
              Add a new API key for authentication
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="new-key-value">Key Value</Label>
              <Textarea
                id="new-key-value"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Enter API key value"
                rows={3}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="new-key-active" className="text-sm">
                Active
              </Label>
              <Switch
                id="new-key-active"
                checked={newKeyActive}
                onCheckedChange={setNewKeyActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewKey("");
                setNewKeyActive(true);
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview key dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key Preview</DialogTitle>
            <DialogDescription>View and copy your API key</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Key Value</Label>
                  <Input
                    value={previewKeyFull || ""}
                    readOnly
                    className="font-mono text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyKey}
                  className="w-full"
                  disabled={!previewKeyFull}
                >
                  Copy Key
                </Button>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreviewDialog(false);
                setPreviewKeyFull(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KeyPicker;
