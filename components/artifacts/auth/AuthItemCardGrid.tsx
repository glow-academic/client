"use client";

import * as React from "react";
import { Plus, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface AuthItemCard {
  id: string;
  name: string;
  description?: string;
  encrypted: boolean;
  active: boolean;
  position: number;
  isNew: boolean;
}

export interface AuthItemCardGridProps {
  items: AuthItemCard[];
  onItemsChange: (items: AuthItemCard[]) => void;
  readonly?: boolean;
}

export function AuthItemCardGrid({
  items,
  onItemsChange,
  readonly = false,
}: AuthItemCardGridProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingField, setEditingField] = React.useState<
    "name" | "description" | null
  >(null);
  const [editingValue, setEditingValue] = React.useState<Partial<AuthItemCard>>(
    {},
  );

  const handleAddItem = () => {
    if (readonly) return;
    const newItem: AuthItemCard = {
      id: `temp-${Date.now()}`,
      name: "",
      description: "",
      encrypted: false,
      active: true,
      position: items.length + 1,
      isNew: true,
    };
    onItemsChange([...items, newItem]);
    setEditingId(newItem.id);
    setEditingField("name");
    setEditingValue({ name: "" });
  };

  const handleRemoveItem = (id: string) => {
    if (readonly) return;
    const newItems = items
      .filter((i) => i.id !== id)
      .map((i, index) => ({ ...i, position: index + 1 }));
    onItemsChange(newItems);
  };

  const handleStartEdit = (
    item: AuthItemCard,
    field: "name" | "description",
  ) => {
    if (readonly) return;
    setEditingId(item.id);
    setEditingField(field);
    setEditingValue({ [field]: item[field] || "" });
  };

  const handleSaveEdit = (id: string, field: "name" | "description") => {
    if (readonly) return;
    if (field === "name" && !editingValue.name?.trim()) {
      handleCancelEdit();
      return;
    }
    const updatedItems = items.map((i) => {
      if (i.id === id) {
        return {
          ...i,
          [field]:
            field === "name"
              ? editingValue.name!.trim()
              : editingValue[field] || "",
        };
      }
      return i;
    });
    onItemsChange(updatedItems);
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
      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Existing Item Cards */}
        {items.map((item) => {
          const isEditingName =
            editingId === item.id && editingField === "name";
          const isEditingDescription =
            editingId === item.id && editingField === "description";

          return (
            <div
              key={item.id}
              className={cn(
                "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
                "hover:shadow-md hover:bg-accent/50",
              )}
            >
              {/* Name Field */}
              {isEditingName ? (
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    type="text"
                    value={editingValue.name || ""}
                    onChange={(e) =>
                      setEditingValue((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Auth item name"
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveEdit(item.id, "name");
                      } else if (e.key === "Escape") {
                        handleCancelEdit();
                      }
                    }}
                    onBlur={() => {
                      if (
                        editingValue.name?.trim() &&
                        editingValue.name.trim() !== item.name
                      ) {
                        handleSaveEdit(item.id, "name");
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
                        handleSaveEdit(item.id, "name");
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
                        handleStartEdit(item, "name");
                      }}
                    >
                      <input
                        type="text"
                        value={item.name || ""}
                        readOnly
                        className={cn(
                          "w-full text-sm font-medium border-none outline-none bg-transparent px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                          item.name
                            ? "text-foreground cursor-pointer hover:bg-muted/50"
                            : "text-muted-foreground cursor-pointer hover:bg-muted/50",
                        )}
                        placeholder="Click to edit name"
                        disabled={readonly}
                      />
                    </div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveItem(item.id);
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
                      setEditingValue((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
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
                      const newDesc = editingValue.description || "";
                      if (newDesc !== (item.description || "")) {
                        handleSaveEdit(item.id, "description");
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
                        handleSaveEdit(item.id, "description");
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
                    handleStartEdit(item, "description");
                  }}
                >
                  {item.description ? (
                    <span className="whitespace-pre-wrap">
                      {item.description}
                    </span>
                  ) : (
                    <span className="italic">Click to edit description</span>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add Item Card */}
        {!readonly && (
          <button
            type="button"
            onClick={handleAddItem}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed bg-card text-card-foreground shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50 hover:border-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Add Auth Item
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
