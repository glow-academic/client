"use client";

import * as React from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface StandardGroupCard {
  id: string;
  name: string;
  description?: string;
  points?: number;
  passPoints?: number;
  position?: number;
  active?: boolean;
}

export interface RubricStandardGroupCardGridProps {
  groups: StandardGroupCard[];
  onGroupsChange: (groups: StandardGroupCard[]) => void;
  readonly?: boolean;
}

export function RubricStandardGroupCardGrid({
  groups,
  onGroupsChange,
  readonly = false,
}: RubricStandardGroupCardGridProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingField, setEditingField] = React.useState<"name" | "description" | null>(null);
  const [editingValue, setEditingValue] = React.useState<Partial<StandardGroupCard>>({});
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter groups based on search term, preserving original order
  const filteredGroups = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return groups;
    }
    const searchLower = searchTerm.toLowerCase();
    return groups.filter((group) =>
      group.name.toLowerCase().includes(searchLower)
    );
  }, [groups, searchTerm]);

  const handleAddGroup = () => {
    if (readonly) return;
    const newGroup: StandardGroupCard = {
      id: `temp-${Date.now()}`,
      name: "",
      description: "",
      position: groups.length + 1,
    };
    onGroupsChange([...groups, newGroup]);
    setEditingId(newGroup.id);
    setEditingField("name");
    setEditingValue({ name: "" });
  };

  const handleRemoveGroup = (id: string) => {
    if (readonly) return;
    const newGroups = groups
      .filter((g) => g.id !== id)
      .map((g, index) => ({ ...g, position: index + 1 }));
    onGroupsChange(newGroups);
  };

  const handleStartEdit = (group: StandardGroupCard, field: "name" | "description") => {
    if (readonly) return;
    setEditingId(group.id);
    setEditingField(field);
    setEditingValue({ [field]: group[field] || "" });
  };

  const handleSaveEdit = (id: string, field: "name" | "description") => {
    if (readonly) return;
    if (field === "name" && !editingValue.name?.trim()) {
      handleCancelEdit();
      return;
    }
    const updatedGroups = groups.map((g) => {
      if (g.id === id) {
        return {
          ...g,
          [field]: field === "name" ? editingValue.name!.trim() : (editingValue.description || ""),
        };
      }
      return g;
    });
    onGroupsChange(updatedGroups);
    setEditingId(null);
    setEditingField(null);
    setEditingValue({});
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue({});
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search standard groups..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto py-2 px-2">
        {/* Existing Group Cards */}
        {filteredGroups.map((group) => {
            const isEditingName = editingId === group.id && editingField === "name";
            const isEditingDescription = editingId === group.id && editingField === "description";
            const isEditing = isEditingName || isEditingDescription;

            return (
              <div
                key={group.id}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
                  "hover:shadow-md hover:bg-accent/50",
                  !isEditing && "cursor-pointer",
                  !group.active && "opacity-60"
                )}
              >
                {/* Name Field */}
                {isEditingName ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      type="text"
                      value={editingValue.name || ""}
                      onChange={(e) =>
                        setEditingValue((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Standard group name"
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveEdit(group.id, "name");
                        } else if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      onBlur={() => {
                        // Auto-save on blur if value changed
                        if (editingValue.name?.trim() && editingValue.name.trim() !== group.name) {
                          handleSaveEdit(group.id, "name");
                        } else {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveEdit(group.id, "name");
                        }}
                        disabled={readonly}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        disabled={readonly}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <div
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(group, "name");
                        }}
                      >
                        <input
                          type="text"
                          value={group.name || ""}
                          readOnly
                          className={cn(
                            "w-full text-sm font-medium border-none outline-none bg-transparent px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                            group.name
                              ? "text-foreground cursor-pointer hover:bg-muted/50"
                              : "text-muted-foreground cursor-pointer hover:bg-muted/50"
                          )}
                          placeholder="Click to edit standard group name"
                          disabled={readonly}
                        />
                      </div>
                      {groups.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveGroup(group.id);
                          }}
                          disabled={readonly}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Description Field */}
                {isEditingDescription ? (
                  <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                    <Textarea
                      value={editingValue.description || ""}
                      onChange={(e) =>
                        setEditingValue((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Click to edit description"
                      className="min-h-[60px] text-sm resize-none"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      onBlur={() => {
                        // Auto-save on blur if value changed
                        const newDesc = editingValue.description || "";
                        if (newDesc !== (group.description || "")) {
                          handleSaveEdit(group.id, "description");
                        } else {
                          handleCancelEdit();
                        }
                      }}
                    />
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveEdit(group.id, "description");
                        }}
                        disabled={readonly}
                        className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleCancelEdit();
                        }}
                        disabled={readonly}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-xs text-muted-foreground px-2 py-1 rounded cursor-pointer hover:bg-muted/50 transition-colors min-h-[20px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(group, "description");
                    }}
                  >
                    {group.description ? (
                      <span className="whitespace-pre-wrap">{group.description}</span>
                    ) : (
                      <span className="italic">Click to edit description</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

        {/* Add Group Card */}
        {!readonly && (
          <button
            type="button"
            onClick={handleAddGroup}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed bg-card text-card-foreground shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50 hover:border-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Add Standard Group</span>
          </button>
        )}
      </div>
    </div>
  );
}

