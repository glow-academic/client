/**
 * Roles.tsx
 * Resource component for role selection
 * Uses SelectableGrid for grid card layout (like Cohorts.tsx)
 */

"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { SelectableGrid } from "@/components/common/forms/SelectableGrid";
import {
  STAFF_ROLES,
  generateGradientFromHex,
} from "@/components/common/forms/staff-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { OutputOf } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { ICON_MAP, ICON_NAMES } from "@/utils/icons";
import { Check, Pencil, Plus, User, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

// Derive resource item type from the GET endpoint response
type RolesGetResponse = OutputOf<"/api/v4/resources/roles/get", "post">;
export type RolesResourceItem = NonNullable<RolesGetResponse["items"]>[number];

export interface RolesProps {
  role?: string | null;
  role_options?: string[];
  roles?: RolesResourceItem[];
  show_roles?: boolean;
  disabled?: boolean;
  editable?: boolean;
  multiSelect?: boolean;
  role_ids?: string[];
  onRoleChange: (roleId: string) => void;
  onRolesChange?: (ids: string[]) => void;
  label?: string;
  id?: string;
  required?: boolean;
  searchTerm?: string;
  showSelectedFilter?: boolean;
  emptyMessage?: string;
  onRoleResourceChange?: (
    roleId: string,
    updates: {
      name: string;
      description: string;
      icon_value: string;
      color_hex: string;
    }
  ) => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  // AI diff view props
  aiRoleResources?: Pick<RolesResourceItem, "id" | "name">[] | null;
  onAccept?: () => void;
  onReject?: () => void;
}

type RoleItem = {
  id: string;
  name: string;
  description: string;
  iconValue: string;
  icon: typeof User;
  color: string;
};

type RoleDraft = {
  name: string;
  description: string;
  iconValue: string;
  color: string;
};

type IconOption = {
  id: string;
  label: string;
};

const formatIconLabel = (iconName: string) =>
  iconName.replace(/([A-Z])/g, " $1").trim();

const ICON_OPTIONS: IconOption[] = ICON_NAMES.map((iconName) => ({
  id: iconName,
  label: formatIconLabel(iconName),
}));

const normalizeHex = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
};

const getIconKeyFromComponent = (icon: RoleItem["icon"]) => {
  const entry = Object.entries(ICON_MAP).find(
    ([, IconComponent]) => IconComponent === icon
  );
  return entry?.[0] ?? "User";
};

function RoleEditor({
  draft,
  onChange,
  iconOptions,
  colorSwatches,
  disabled,
}: {
  draft: RoleDraft;
  onChange: (next: RoleDraft) => void;
  iconOptions: IconOption[];
  colorSwatches: string[];
  disabled?: boolean;
}) {
  const currentIcon = draft.iconValue || "User";

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Input
          value={draft.name}
          onChange={(event) =>
            onChange({ ...draft, name: event.target.value })
          }
          placeholder="Role name"
          className="h-8"
          disabled={disabled}
        />
        <Textarea
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
          placeholder="Role description"
          className="min-h-[60px] text-sm"
          disabled={disabled}
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <GenericPicker<IconOption>
            items={iconOptions}
            selectedIds={currentIcon ? [currentIcon] : []}
            onSelect={(ids) => {
              const nextIcon = ids[0] ?? "User";
              onChange({ ...draft, iconValue: nextIcon });
            }}
            getId={(item) => item.id}
            getLabel={(item) => item.label}
            renderItem={(item) => {
              const IconComponent =
                ICON_MAP[item.id] ?? ICON_MAP.User;
              return (
                <div className="flex items-center gap-2">
                  <IconComponent className="h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                </div>
              );
            }}
            placeholder="Icon"
            searchPlaceholder="Search icons..."
            showLabel={false}
            compact={true}
            buttonClassName="h-8"
            disabled={disabled}
          />
          <div className="flex items-center gap-2">
            <div
              className="h-7 w-7 rounded-md border"
              style={{
                background:
                  normalizeHex(draft.color) || "var(--muted-foreground)",
              }}
            />
            <Input
              value={draft.color}
              onChange={(event) =>
                onChange({ ...draft, color: event.target.value })
              }
              placeholder="#64748b"
              className="h-8 w-[120px]"
              disabled={disabled}
            />
          </div>
        </div>
        {colorSwatches.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {colorSwatches.map((hex) => (
              <button
                key={hex}
                type="button"
                className={cn(
                  "h-5 w-5 rounded-full border",
                  normalizeHex(draft.color).toLowerCase() ===
                    normalizeHex(hex).toLowerCase() && "ring-2 ring-primary"
                )}
                style={{ background: hex }}
                onClick={() => onChange({ ...draft, color: hex })}
                disabled={disabled}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Roles({
  role,
  role_options,
  roles,
  show_roles = true,
  disabled = false,
  editable = true,
  multiSelect = false,
  role_ids,
  onRoleChange,
  onRolesChange,
  label = "Role",
  id = "role",
  required = true,
  searchTerm = "",
  showSelectedFilter = false,
  emptyMessage = "No roles found. Try adjusting your search.",
  onRoleResourceChange,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
  // AI diff view props
  aiRoleResources,
  onAccept,
  onReject,
}: RolesProps) {
  // AI suggestion state
  const showDiff = multiSelect && !!aiRoleResources?.length;
  const aiSuggestedIds = useMemo(
    () =>
      new Set(
        aiRoleResources
          ?.map((r) => r.id)
          .filter(Boolean) as string[]
      ),
    [aiRoleResources]
  );

  const [roleOverrides, setRoleOverrides] = useState<
    Record<string, RoleDraft>
  >({});
  const [localRoles, setLocalRoles] = useState<RoleItem[]>([]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<RoleDraft | null>(null);
  const [isAddingCustomRole, setIsAddingCustomRole] = useState(false);
  const [newCustomDraft, setNewCustomDraft] = useState<RoleDraft>({
    name: "",
    description: "",
    iconValue: "User",
    color: "#64748b",
  });

  const baseRoles = useMemo(() => {
    const roleResources =
      roles
        ?.filter((r) => r.role || r.id)
        .map((r) => {
          const iconKey = r.icon_value ?? "User";
          const IconComponent = ICON_MAP[iconKey] ?? User;

          return {
            id: (multiSelect && r.id ? r.id : r.role) as string,
            name: r.name ?? r.role ?? "Role",
            description: r.description ?? "",
            iconValue: iconKey,
            icon: IconComponent,
            color: r.color_hex ?? "#64748b",
          } as RoleItem;
        }) ?? [];

    if (roleResources.length > 0) {
      return roleResources;
    }

    return STAFF_ROLES.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? "",
      iconValue: getIconKeyFromComponent(r.icon),
      icon: r.icon,
      color: r.color,
    }));
  }, [roles, multiSelect]);

  const availableRoles = useMemo(() => {
    const roleSet = new Set<string>();
    const merged: RoleItem[] = [];
    const allowAll = !role_options || role_options.length === 0;
    const allowRole = (roleId: string) =>
      allowAll || role_options?.includes(roleId);
    const addRole = (item: RoleItem) => {
      if (!allowRole(item.id)) return;
      if (roleSet.has(item.id)) return;
      roleSet.add(item.id);
      merged.push(item);
    };

    baseRoles.forEach(addRole);
    localRoles.forEach(addRole);

    return merged.map((item) => {
      const override = roleOverrides[item.id];
      if (!override) return item;
      const iconKey = override.iconValue || item.iconValue;
      const IconComponent = ICON_MAP[iconKey] ?? User;
      return {
        ...item,
        name: override.name || item.name,
        description: override.description || item.description,
        iconValue: iconKey,
        icon: IconComponent,
        color: normalizeHex(override.color) || item.color,
      };
    });
  }, [baseRoles, localRoles, role_options, roleOverrides]);

  const colorSwatches = useMemo(() => {
    const colors = new Set<string>();
    STAFF_ROLES.forEach((r) => colors.add(r.color));
    baseRoles.forEach((r) => colors.add(r.color));
    localRoles.forEach((r) => colors.add(r.color));
    return Array.from(colors);
  }, [baseRoles, localRoles]);

  const canAddCustomRole = useMemo(() => {
    if (disabled) return false;
    if (role_options && role_options.length > 0) {
      return role_options.includes("custom");
    }
    return true;
  }, [disabled, role_options]);

  const hasCustomRole = useMemo(
    () => availableRoles.some((r) => r.id === "custom"),
    [availableRoles]
  );

  const defaultCustomRole = useMemo(() => {
    const baseCustom = STAFF_ROLES.find((r) => r.id === "custom");
    if (!baseCustom) {
      return {
        name: "Custom",
        description: "Custom role",
        iconValue: "User",
        color: "#64748b",
      };
    }
    return {
      name: baseCustom.name,
      description: baseCustom.description ?? "",
      iconValue: getIconKeyFromComponent(baseCustom.icon),
      color: baseCustom.color,
    };
  }, []);

  const filteredRoles = useMemo(() => {
    let roles = availableRoles;
    const trimmedSearch = searchTerm.trim().toLowerCase();

    if (trimmedSearch) {
      roles = roles.filter(
        (r) =>
          r.name.toLowerCase().includes(trimmedSearch) ||
          r.description.toLowerCase().includes(trimmedSearch) ||
          r.id.toLowerCase().includes(trimmedSearch)
      );
    }

    if (showSelectedFilter && role) {
      roles = roles.filter((r) => r.id === role);
    }

    return [...roles];
  }, [availableRoles, searchTerm, showSelectedFilter, role]);

  // Accept AI suggestion - add AI-suggested roles to selection (multi-select only)
  const handleAccept = useCallback(() => {
    if (!aiRoleResources?.length || !multiSelect || !onRolesChange) return;
    const currentIds = role_ids ?? [];
    const newIds = aiRoleResources
      .map((r) => r.id)
      .filter((id): id is string => !!id && !currentIds.includes(id));
    if (newIds.length > 0) {
      onRolesChange([...currentIds, ...newIds]);
    }
    onAccept?.();
  }, [aiRoleResources, role_ids, onRolesChange, onAccept, multiSelect]);

  // Reject AI suggestion - just clear the pending state
  const handleReject = useCallback(() => {
    onReject?.();
  }, [onReject]);

  if (!show_roles) {
    return null;
  }

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
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
      <SelectableGrid
        horizontal
        items={filteredRoles}
        selectedId={multiSelect ? null : (role ?? null)}
        {...(multiSelect ? { selectedIds: role_ids ?? [] } : {})}
        onSelect={(roleId) => {
          if (multiSelect && onRolesChange) {
            const currentIds = role_ids ?? [];
            if (currentIds.includes(roleId)) {
              onRolesChange(currentIds.filter((id) => id !== roleId));
            } else {
              onRolesChange([...currentIds, roleId]);
            }
          } else {
            onRoleChange(roleId);
          }
        }}
        getId={(item) => item.id}
        renderItem={(item, isSelected) => {
          const IconComponent = item.icon;
          const gradientStyle = generateGradientFromHex(item.color);
          const isEditing = editingRoleId === item.id;
          const isAiSuggested = showDiff && aiSuggestedIds.has(item.id);

          return (
            <div
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                "hover:shadow-md hover:bg-accent/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected && "ring-2 ring-primary bg-accent",
                isAiSuggested && !isSelected && "ring-2 ring-success bg-success/10"
              )}
            >
              {!disabled && editable && (
                <Popover
                  open={isEditing}
                  onOpenChange={(open) => {
                    if (!open) {
                      setEditingRoleId(null);
                      setEditingDraft(null);
                    }
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 left-2 h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingRoleId(item.id);
                        setEditingDraft({
                          name: item.name,
                          description: item.description,
                          iconValue: item.iconValue,
                          color: item.color,
                        });
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[320px]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {editingDraft && (
                      <div className="space-y-3">
                        <RoleEditor
                          draft={editingDraft}
                          onChange={setEditingDraft}
                          iconOptions={ICON_OPTIONS}
                          colorSwatches={colorSwatches}
                          disabled={disabled}
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingRoleId(null);
                              setEditingDraft(null);
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (!editingDraft || !editingRoleId) return;
                              const normalized = {
                                name: editingDraft.name.trim() || item.name,
                                description:
                                  editingDraft.description.trim() ||
                                  item.description,
                                iconValue:
                                  editingDraft.iconValue || item.iconValue,
                                color:
                                  normalizeHex(editingDraft.color) ||
                                  item.color,
                              };
                              setRoleOverrides((prev) => ({
                                ...prev,
                                [editingRoleId]: normalized,
                              }));
                              onRoleResourceChange?.(editingRoleId, {
                                name: normalized.name,
                                description: normalized.description,
                                icon_value: normalized.iconValue,
                                color_hex: normalized.color,
                              });
                              setEditingRoleId(null);
                              setEditingDraft(null);
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {isSelected && (
                <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
              {isAiSuggested && !isSelected && (
                <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-success/20 text-success text-[10px] rounded font-medium">
                  AI Suggested
                </div>
              )}
              <div className="flex items-start gap-3">
                <div
                  className="p-2 rounded-lg shadow-sm flex-shrink-0"
                  style={{ background: gradientStyle }}
                >
                  <IconComponent className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm leading-tight">
                    {item.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        }}
        emptyMessage={emptyMessage}
        disabled={disabled}
      />
      {!disabled && editable && canAddCustomRole && !hasCustomRole && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3">
          {isAddingCustomRole ? (
            <div className="space-y-3">
              <RoleEditor
                draft={newCustomDraft}
                onChange={setNewCustomDraft}
                iconOptions={ICON_OPTIONS}
                colorSwatches={colorSwatches}
                disabled={disabled}
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingCustomRole(false);
                    setNewCustomDraft(defaultCustomRole);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const normalized = {
                      name: newCustomDraft.name.trim() || "Custom",
                      description: newCustomDraft.description.trim(),
                      iconValue: newCustomDraft.iconValue || "User",
                      color:
                        normalizeHex(newCustomDraft.color) || "#64748b",
                    };
                    setLocalRoles((prev) => [
                      ...prev,
                      {
                        id: "custom",
                        name: normalized.name,
                        description: normalized.description,
                        iconValue: normalized.iconValue,
                        icon:
                          ICON_MAP[normalized.iconValue] ?? User,
                        color: normalized.color,
                      },
                    ]);
                    setRoleOverrides((prev) => ({
                      ...prev,
                      custom: normalized,
                    }));
                    onRoleResourceChange?.("custom", {
                      name: normalized.name,
                      description: normalized.description,
                      icon_value: normalized.iconValue,
                      color_hex: normalized.color,
                    });
                    onRoleChange("custom");
                    setIsAddingCustomRole(false);
                    setNewCustomDraft(defaultCustomRole);
                  }}
                >
                  Add role
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsAddingCustomRole(true);
                setNewCustomDraft(defaultCustomRole);
              }}
              className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Add custom role
            </button>
          )}
        </div>
      )}
    </div>
  );
}
