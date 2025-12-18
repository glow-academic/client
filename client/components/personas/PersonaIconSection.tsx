/**
 * PersonaIconSection.tsx
 * Icon selection section for Persona form with searchable icon picker
 */
"use client";

import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PERSONA_ICON_MAP } from "@/utils/persona-icons";

export interface PersonaIconSectionProps {
  icon: string;
  suggestedIcons: string[];
  validIcons: string[];
  onIconChange: (icon: string) => void;
  stepStatus: "pending" | "active" | "completed";
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly: boolean;
}

export function PersonaIconSection({
  icon,
  suggestedIcons,
  validIcons,
  onIconChange,
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isReadonly,
}: PersonaIconSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Combine suggested icons first, then valid icons (excluding suggested ones)
  const allIcons = useMemo(() => {
    const suggestedSet = new Set(suggestedIcons);
    const otherIcons = validIcons.filter(
      (iconName) => !suggestedSet.has(iconName),
    );
    return [...suggestedIcons, ...otherIcons];
  }, [suggestedIcons, validIcons]);

  // Filter icons based on search term
  const filteredIcons = useMemo(() => {
    if (!searchTerm.trim()) {
      return allIcons;
    }
    const searchLower = searchTerm.toLowerCase();
    return allIcons.filter((iconName) =>
      iconName.toLowerCase().includes(searchLower),
    );
  }, [allIcons, searchTerm]);

  const handleIconSelect = (selectedIcon: string) => {
    if (isReadonly) return;
    onIconChange(selectedIcon);
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              <span>{stepNumber}</span>
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search icons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Icon Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
          {filteredIcons.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No icons found. Try adjusting your search.
            </div>
          ) : (
            filteredIcons.map((iconName) => {
              const IconComponent =
                PERSONA_ICON_MAP[iconName as keyof typeof PERSONA_ICON_MAP];
              if (!IconComponent) return null;

              const isSelected = icon === iconName;
              const isSuggested = suggestedIcons.includes(iconName);

              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => handleIconSelect(iconName)}
                  disabled={isReadonly}
                  data-testid="icon-option"
                  data-icon={iconName}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent",
                  )}
                >
                  {/* Check icon - top right */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}

                  {/* Suggested badge - top left */}
                  {isSuggested && !isSelected && (
                    <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
                      Suggested
                    </div>
                  )}

                  <div className="flex flex-col items-center gap-2">
                    <IconComponent className="h-8 w-8 text-foreground" />
                    <span className="text-sm font-medium text-center">
                      {iconName}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
