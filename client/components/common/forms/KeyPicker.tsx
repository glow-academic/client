/**
 * KeyPicker.tsx
 * Picker for selecting API keys with masked preview and create functionality
 */
"use client";

import { Check, ChevronsUpDown, Copy, Eye, EyeOff, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/auth/page";

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
import { cn } from "@/lib/utils";

type KeyMappingItem = {
  name: string;
  description: string; // Full encrypted key
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
  /** Server action for decrypting keys */
  decryptKeyAction?: (input: DecryptKeyIn) => Promise<DecryptKeyOut>;
  /** Server action for updating keys */
  updateKeyAction?: (input: UpdateKeyIn) => Promise<UpdateKeyOut>;
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
  decryptKeyAction,
  updateKeyAction,
  keyType = "auth",
}: KeyPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newKeyActive, setNewKeyActive] = useState(true);
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [previewKeyFull, setPreviewKeyFull] = useState<string | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState("");
  const [editingKeyValue, setEditingKeyValue] = useState("");
  const [editingKeyActive, setEditingKeyActive] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // Build keys from mapping
  const keys = useMemo(() => {
    return validIds.map((id) => ({
      id,
      ...mapping[id],
    }));
  }, [validIds, mapping]);

  // Filter keys by search (search by name)
  const filteredKeys = useMemo(() => {
    if (!search.trim()) return keys;
    const searchLower = search.toLowerCase();
    return keys.filter((key) => {
      const name = key.name?.toLowerCase() || "";
      return name.includes(searchLower);
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
        const names = selectedIds
          .map((id) => mapping[id]?.name)
          .filter(Boolean) as string[];
        if (names.length === 0) {
          return `${selectedIds.length} keys selected${requiredIndicator}`;
        }
        return names.join(", ") + requiredIndicator;
      }
      return `${selectedIds.length} keys selected${requiredIndicator}`;
    }
    return (
      (mapping[selectedIds[0]!]?.name || `Select key${requiredIndicator}`) +
      requiredIndicator
    );
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Key name is required");
      return;
    }
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
          name: newKeyName.trim(),
          key: newKey.trim(),
          type: keyType,
          active: newKeyActive,
        },
      });

      toast.success("Key created successfully");
      setShowCreateDialog(false);
      setNewKeyName("");
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

  const handleEdit = async (keyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const key = mapping[keyId];
    if (!key) return;

    setEditingKeyId(keyId);
    setEditingKeyName(key.name);
    setEditingKeyValue("");
    setEditingKeyActive(key.active);
    setIsPreviewVisible(false);
    setIsEditMode(false);
    setPreviewKeyFull(null); // Will show masked value from mapping initially
    setShowPreviewDialog(true);
  };

  const handleTogglePreview = async () => {
    if (!editingKeyId || !decryptKeyAction) {
      toast.error("Decrypt action is not available");
      return;
    }

    if (isPreviewVisible) {
      setIsPreviewVisible(false);
      setPreviewKeyFull(null);
    } else {
      setIsLoadingPreview(true);
      try {
        const response = await decryptKeyAction({
          body: { keyId: editingKeyId, profileId: "" },
        });
        setPreviewKeyFull(response.key);
        setIsPreviewVisible(true);
      } catch (error) {
        toast.error("Failed to decrypt key", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        setIsLoadingPreview(false);
      }
    }
  };

  const handleEnterEditMode = async () => {
    if (!editingKeyId || !decryptKeyAction) {
      toast.error("Decrypt action is not available");
      return;
    }

    setIsLoadingPreview(true);
    try {
      const response = await decryptKeyAction({
        body: { keyId: editingKeyId, profileId: "" },
      });
      setEditingKeyValue(response.key);
      setIsEditMode(true);
      setIsPreviewVisible(false);
      setPreviewKeyFull(null);
    } catch (error) {
      toast.error("Failed to decrypt key", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingKeyId || !updateKeyAction) {
      toast.error("Update action is not available");
      return;
    }

    if (!editingKeyName.trim()) {
      toast.error("Key name is required");
      return;
    }

    if (!editingKeyValue.trim()) {
      toast.error("Key value is required");
      return;
    }

    try {
      setIsUpdating(true);
      await updateKeyAction({
        body: {
          keyId: editingKeyId,
          name: editingKeyName.trim(),
          key: editingKeyValue.trim(),
          active: editingKeyActive,
        },
      });

      toast.success("Key updated successfully");
      setShowPreviewDialog(false);
      setIsEditMode(false);
      setIsPreviewVisible(false);
      setEditingKeyId(null);
      setPreviewKeyFull(null);
      router.refresh();
    } catch (error) {
      toast.error("Failed to update key", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setIsPreviewVisible(false);
    setEditingKeyId(null);
    setEditingKeyValue("");
    setPreviewKeyFull(null);
    setShowPreviewDialog(false);
  };

  const handleCopyKey = () => {
    if (previewKeyFull) {
      navigator.clipboard.writeText(previewKeyFull);
      toast.success("Key copied to clipboard");
    }
  };

  const handleDialogClose = () => {
    handleCancelEdit();
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
            <span className="truncate max-w-[200px]">{key.name}</span>
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
              endAdornment={
                createKeyAction ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Create new key"
                    title="Create new key"
                    className="relative hover:bg-accent overflow-visible h-8 w-8 p-0 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCreateDialog(true);
                      setOpen(false);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : undefined
              }
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
                {filteredKeys.map((key) => (
                  <CommandItem
                    key={key.id}
                    onSelect={() => handleKeySelect(key.id)}
                    value={key.name || ""}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(key.id, e);
                        }}
                        className="inline-flex items-center hover:opacity-70 flex-shrink-0"
                        aria-label="Edit key"
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{key.name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {key.key_masked || "••••••••"}
                        </div>
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
              <Label htmlFor="new-key-name">Key Name</Label>
              <Input
                id="new-key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Enter key name"
              />
            </div>
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
                setNewKeyName("");
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

      {/* Preview/Edit key dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit Key" : "Key Details"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update key information"
                : "View and edit your API key"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {isLoadingPreview ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
              </div>
            ) : isEditMode ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="edit-key-name">Key Name</Label>
                  <Input
                    id="edit-key-name"
                    value={editingKeyName}
                    onChange={(e) => setEditingKeyName(e.target.value)}
                    placeholder="Enter key name"
                    disabled={isUpdating}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-key-value">Key Value</Label>
                  <Textarea
                    id="edit-key-value"
                    value={editingKeyValue}
                    onChange={(e) => setEditingKeyValue(e.target.value)}
                    placeholder="Enter API key value"
                    rows={3}
                    className="font-mono text-sm"
                    disabled={isUpdating}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="edit-key-active" className="text-sm">
                    Active
                  </Label>
                  <Switch
                    id="edit-key-active"
                    checked={editingKeyActive}
                    onCheckedChange={setEditingKeyActive}
                    disabled={isUpdating}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label>Key Name</Label>
                  <Input
                    value={editingKeyName || ""}
                    readOnly
                    className="font-mono text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Key Value</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={isPreviewVisible ? "text" : "password"}
                      value={
                        isPreviewVisible
                          ? previewKeyFull || ""
                          : mapping[editingKeyId || ""]?.key_masked || "••••••••"
                      }
                      readOnly
                      className="font-mono text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleTogglePreview}
                      disabled={!decryptKeyAction}
                      className="h-9 w-9 flex-shrink-0"
                      aria-label={isPreviewVisible ? "Hide key" : "Show key"}
                    >
                      {isPreviewVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    {isPreviewVisible && (
                      <Button
                        type="button"
                        variant="default"
                        size="icon"
                        onClick={handleCopyKey}
                        disabled={!previewKeyFull}
                        className="h-9 w-9 flex-shrink-0"
                        aria-label="Copy key"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Active</Label>
                  <Switch checked={editingKeyActive} disabled />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            {isEditMode ? (
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                >
                  Close
                </Button>
                <Button
                  onClick={handleEnterEditMode}
                  disabled={!updateKeyAction}
                >
                  Edit
                </Button>
              </>
            )}
            {isEditMode && (
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? "Saving..." : "Save"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default KeyPicker;
