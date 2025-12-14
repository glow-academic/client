/**
 * PersonaColorSection.tsx
 * Color selection section for Persona form with searchable preset colors and hex input
 */
"use client";

import { Check, Search } from "lucide-react";
import React, { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Color name mapping for common hex colors
const getColorName = (hex: string): string => {
  const colorMap: Record<string, string> = {
    // Standard colors
    "#000000": "Black",
    "#FFFFFF": "White",
    "#FF0000": "Red",
    "#00FF00": "Green",
    "#0000FF": "Blue",
    "#FFFF00": "Yellow",
    "#FF00FF": "Magenta",
    "#00FFFF": "Cyan",
    "#FFA500": "Orange",
    "#800080": "Purple",
    "#FFC0CB": "Pink",
    "#A52A2A": "Brown",
    "#808080": "Gray",
    "#FFD700": "Gold",
    "#C0C0C0": "Silver",
    "#008000": "Dark Green",
    "#000080": "Navy",
    "#800000": "Maroon",
    "#FF6347": "Tomato",
    "#40E0D0": "Turquoise",
    "#EE82EE": "Violet",
    "#F0E68C": "Khaki",
    "#90EE90": "Light Green",
    "#87CEEB": "Sky Blue",
    "#DDA0DD": "Plum",
    "#F5DEB3": "Wheat",
    "#FF7F50": "Coral",
    "#6495ED": "Cornflower Blue",
    "#DC143C": "Crimson",
    "#00CED1": "Dark Turquoise",
    "#FF1493": "Deep Pink",
    "#1E90FF": "Dodger Blue",
    "#B22222": "Fire Brick",
    "#228B22": "Forest Green",
    "#DAA520": "Goldenrod",
    "#ADFF2F": "Green Yellow",
    "#FF69B4": "Hot Pink",
    "#CD5C5C": "Indian Red",
    "#4B0082": "Indigo",
    "#FFFFF0": "Ivory",
    "#E6E6FA": "Lavender",
    "#FFF0F5": "Lavender Blush",
    "#7CFC00": "Lawn Green",
    "#FFFACD": "Lemon Chiffon",
    "#ADD8E6": "Light Blue",
    "#F08080": "Light Coral",
    "#E0FFFF": "Light Cyan",
    "#FAFAD2": "Light Goldenrod Yellow",
    "#D3D3D3": "Light Gray",
    "#FFB6C1": "Light Pink",
    "#FFA07A": "Light Salmon",
    "#20B2AA": "Light Sea Green",
    "#87CEFA": "Light Sky Blue",
    "#778899": "Light Slate Gray",
    "#B0C4DE": "Light Steel Blue",
    "#FFFFE0": "Light Yellow",
    "#32CD32": "Lime Green",
    "#FAF0E6": "Linen",
    "#66CDAA": "Medium Aquamarine",
    "#0000CD": "Medium Blue",
    "#BA55D3": "Medium Orchid",
    "#9370DB": "Medium Purple",
    "#3CB371": "Medium Sea Green",
    "#7B68EE": "Medium Slate Blue",
    "#00FA9A": "Medium Spring Green",
    "#48D1CC": "Medium Turquoise",
    "#C71585": "Medium Violet Red",
    "#191970": "Midnight Blue",
    "#F5FFFA": "Mint Cream",
    "#FFE4E1": "Misty Rose",
    "#FFE4B5": "Moccasin",
    "#FFDEAD": "Navajo White",
    "#FDF5E6": "Old Lace",
    "#808000": "Olive",
    "#6B8E23": "Olive Drab",
    "#FF4500": "Orange Red",
    "#DA70D6": "Orchid",
    "#EEE8AA": "Pale Goldenrod",
    "#98FB98": "Pale Green",
    "#AFEEEE": "Pale Turquoise",
    "#DB7093": "Pale Violet Red",
    "#FFEFD5": "Papaya Whip",
    "#FFDAB9": "Peach Puff",
    "#CD853F": "Peru",
    "#B0E0E6": "Powder Blue",
    "#BC8F8F": "Rosy Brown",
    "#4169E1": "Royal Blue",
    "#8B4513": "Saddle Brown",
    "#FA8072": "Salmon",
    "#F4A460": "Sandy Brown",
    "#2E8B57": "Sea Green",
    "#FFF5EE": "Sea Shell",
    "#A0522D": "Sienna",
    "#6A5ACD": "Slate Blue",
    "#708090": "Slate Gray",
    "#FFFAFA": "Snow",
    "#00FF7F": "Spring Green",
    "#4682B4": "Steel Blue",
    "#D2B48C": "Tan",
    "#008080": "Teal",
    "#D8BFD8": "Thistle",
    "#F5F5F5": "White Smoke",
    "#9ACD32": "Yellow Green",
    // Tailwind preset colors (from server)
    "#EF4444": "Red",
    "#F97316": "Orange",
    "#F59E0B": "Amber",
    "#EAB308": "Yellow",
    "#84CC16": "Lime",
    "#22C55E": "Green",
    "#10B981": "Emerald",
    "#14B8A6": "Teal",
    "#06B6D4": "Cyan",
    "#0EA5E9": "Sky",
    "#3B82F6": "Blue",
    "#6366F1": "Indigo",
    "#8B5CF6": "Violet",
    "#A855F7": "Purple",
    "#D946EF": "Fuchsia",
    "#EC4899": "Pink",
    "#F43F5E": "Rose",
  };

  // Normalize hex color (uppercase, ensure # prefix)
  const normalizedHex = hex.toUpperCase().startsWith("#")
    ? hex.toUpperCase()
    : `#${hex.toUpperCase()}`;

  return colorMap[normalizedHex] || normalizedHex;
};

export interface PersonaColorSectionProps {
  color: string;
  presetColors: string[];
  onColorChange: (color: string) => void;
  stepStatus: "pending" | "active" | "completed";
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly: boolean;
}

export function PersonaColorSection({
  color,
  presetColors,
  onColorChange,
  stepStatus,
  stepNumber,
  stepTitle,
  stepDescription,
  isReadonly,
}: PersonaColorSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter colors based on search term (search by both hex and name)
  const filteredColors = useMemo(() => {
    if (!searchTerm.trim()) {
      return presetColors;
    }
    const searchLower = searchTerm.toLowerCase();
    return presetColors.filter((colorValue) => {
      const colorName = getColorName(colorValue).toLowerCase();
      const colorHex = colorValue.toLowerCase();
      return colorName.includes(searchLower) || colorHex.includes(searchLower);
    });
  }, [presetColors, searchTerm]);

  const handleColorSelect = (selectedColor: string) => {
    if (isReadonly) return;
    onColorChange(selectedColor);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow any hex value (with or without #, any length)
    if (value === "" || /^#?[0-9A-Fa-f]*$/.test(value)) {
      onColorChange(value.startsWith("#") ? value : `#${value}`);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50"
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
                  : "bg-muted"
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
        {/* Preset Colors Card Grid */}
        {presetColors.length > 0 && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex h-9 items-center gap-2 border-b px-0 w-full">
              <Search className="size-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder="Search colors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isReadonly}
              />
            </div>

            {/* Color Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[272px] overflow-y-auto py-2 px-2">
              {filteredColors.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No colors found. Try adjusting your search.
                </div>
              ) : (
                filteredColors.map((colorValue) => {
                  const isSelected = color === colorValue;

                  return (
                    <button
                      key={colorValue}
                      type="button"
                      onClick={() => handleColorSelect(colorValue)}
                      disabled={isReadonly}
                      className={cn(
                        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                        "hover:shadow-md hover:bg-accent/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        "disabled:pointer-events-none disabled:opacity-50",
                        isSelected && "ring-2 ring-primary bg-accent"
                      )}
                    >
                      {/* Check icon - top right */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-primary-foreground" />
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
                          style={{ backgroundColor: colorValue }}
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm leading-tight">
                            {getColorName(colorValue)}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {colorValue}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Hex Color Input */}
        <div className="space-y-2">
          <Label htmlFor="colorInput">Hex Color</Label>
          <div className="flex gap-2">
            <Input
              id="colorInput"
              value={color}
              onChange={handleHexInputChange}
              placeholder="#000000"
              className="flex-1"
              disabled={isReadonly}
            />
            <div
              className="w-10 h-10 rounded border"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
