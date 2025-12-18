"use client";

import * as React from "react";
import { Mail, Plus, Trash2, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface StaffEmailCardGridProps {
  emails: string[];
  primaryEmailIndex: number | undefined;
  onEmailsChange: (emails: string[]) => void;
  onPrimaryEmailIndexChange: (index: number | undefined) => void;
  readonly?: boolean;
}

export function StaffEmailCardGrid({
  emails,
  primaryEmailIndex,
  onEmailsChange,
  onPrimaryEmailIndexChange,
  readonly = false,
}: StaffEmailCardGridProps) {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editingValue, setEditingValue] = React.useState("");
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter emails based on search term, preserving original indices
  const filteredEmailIndices = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return emails.map((_, index) => index);
    }
    const searchLower = searchTerm.toLowerCase();
    return emails
      .map((email, index) => ({ email, index }))
      .filter(({ email }) => email.toLowerCase().includes(searchLower))
      .map(({ index }) => index);
  }, [emails, searchTerm]);

  const handleAddEmail = () => {
    if (readonly) return;
    const newEmails = [...emails, ""];
    onEmailsChange(newEmails);
    // If this is the first email, make it primary
    if (emails.length === 0 && primaryEmailIndex === undefined) {
      onPrimaryEmailIndexChange(0);
    }
    setEditingIndex(newEmails.length - 1);
    setEditingValue("");
  };

  const handleRemoveEmail = (index: number) => {
    if (readonly) return;
    const newEmails = emails.filter((_, i) => i !== index);
    if (newEmails.length === 0) {
      onEmailsChange([]);
      onPrimaryEmailIndexChange(undefined);
      return;
    }
    let newPrimaryIndex = primaryEmailIndex;
    if (primaryEmailIndex !== undefined) {
      if (index === primaryEmailIndex) {
        newPrimaryIndex = 0;
      } else if (index < primaryEmailIndex) {
        newPrimaryIndex = primaryEmailIndex - 1;
      }
    }
    onEmailsChange(newEmails);
    if (newPrimaryIndex !== undefined) {
      onPrimaryEmailIndexChange(newPrimaryIndex);
    }
  };

  const handleEmailClick = (index: number) => {
    if (readonly) return;
    // Clicking an email card sets it as primary (without entering edit mode)
    onPrimaryEmailIndexChange(index);
  };

  const handleStartEdit = (index: number, value: string) => {
    if (readonly) return;
    setEditingIndex(index);
    setEditingValue(value);
  };

  const handleSaveEdit = (index: number) => {
    if (readonly) return;
    if (!editingValue.trim()) {
      // Don't save empty emails
      handleCancelEdit();
      return;
    }
    const newEmails = [...emails];
    newEmails[index] = editingValue.trim();
    onEmailsChange(newEmails);
    // If no primary email is selected, make this one primary
    if (primaryEmailIndex === undefined) {
      onPrimaryEmailIndexChange(index);
    }
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue("");
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
        <Search className="size-4 shrink-0 opacity-50" />
        <input
          type="text"
          placeholder="Search emails..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
          disabled={readonly}
        />
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
        {/* Existing Email Cards */}
        {filteredEmailIndices.length === 0 ? (
          <div className="col-span-full text-center py-8 text-muted-foreground">
            No emails found. Try adjusting your search.
          </div>
        ) : (
          filteredEmailIndices.map((index) => {
            const email = emails[index];
            const isPrimary =
              primaryEmailIndex !== undefined && index === primaryEmailIndex;
            const isEditing = editingIndex === index;

            return (
              <div
                key={index}
                className={cn(
                  "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
                  "hover:shadow-md hover:bg-accent/50",
                  isPrimary && "ring-2 ring-primary bg-accent",
                  !isEditing && "cursor-pointer",
                )}
                onClick={() => !isEditing && handleEmailClick(index)}
              >
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Input
                          type="email"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          placeholder="email@example.com"
                          className="h-8 text-sm flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(index);
                            } else if (e.key === "Escape") {
                              handleCancelEdit();
                            }
                          }}
                          onBlur={() => {
                            // Auto-save on blur if value changed
                            if (
                              editingValue.trim() &&
                              editingValue.trim() !== email
                            ) {
                              handleSaveEdit(index);
                            } else {
                              handleCancelEdit();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveEdit(index);
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
                      </>
                    ) : (
                      <>
                        <div
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(index, email || "");
                          }}
                        >
                          <input
                            type="text"
                            value={email || ""}
                            readOnly
                            className={cn(
                              "w-full text-sm border-none outline-none bg-transparent px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                              email
                                ? "text-foreground cursor-pointer hover:bg-muted/50"
                                : "text-muted-foreground cursor-pointer hover:bg-muted/50",
                            )}
                            placeholder="Click to edit email"
                            disabled={readonly}
                          />
                        </div>
                        {emails.length > 1 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveEmail(index);
                            }}
                            disabled={readonly}
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Add Email Card */}
        {!readonly && (
          <button
            type="button"
            onClick={handleAddEmail}
            className={cn(
              "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed bg-card text-card-foreground shadow-sm transition-all",
              "hover:shadow-md hover:bg-accent/50 hover:border-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              Add Email
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
