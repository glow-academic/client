/**
 * RubricStandardSection.tsx
 * Individual standard configuration section component for rubrics
 */
"use client";

import { Check, PlusCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type StepStatus = "pending" | "active" | "completed";

export interface StandardGroup {
  id: string;
  name: string;
  description: string;
  points: number;
  passPoints: number;
  position: number;
  active: boolean;
}

export interface Standard {
  id: string;
  name: string;
  points: number;
  standardGroupId: string;
}

export interface GridCell {
  standardGroupId: string;
  standardId: string;
  description: string;
}

export interface RubricStandardSectionProps {
  // Data
  group: StandardGroup;
  standards: Standard[];
  gridCells: GridCell[];
  position: number;
  totalGroups: number;

  // Callbacks
  onGroupChange: (groupId: string, updates: Partial<StandardGroup>) => void;
  onStandardsChange: (standards: Standard[]) => void;
  onGridCellChange: (
    groupId: string,
    standardId: string,
    description: string,
  ) => void;
  onAddStandard: (groupId: string) => void;
  onRemoveStandard: (groupId: string, standardId: string) => void;

  // UI State
  readonly?: boolean;
  stepStatus?: StepStatus;
  stepNumber?: number;
  isEditMode?: boolean;
}

export function RubricStandardSection({
  group,
  standards,
  position,
  onGroupChange,
  onStandardsChange,
  onAddStandard,
  onRemoveStandard,
  readonly = false,
  stepStatus = "active",
  stepNumber,
  isEditMode = false,
}: RubricStandardSectionProps) {
  const groupStandards = standards.filter(
    (s) => s.standardGroupId === group.id,
  );
  const displayNumber = stepNumber ?? position;

  return (
    <Card
      className={cn(
        "transition-all",
        !isEditMode && stepStatus === "active" && "ring-2 ring-primary",
        !isEditMode && stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
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
              <span>{displayNumber}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {group.name}
            </CardTitle>
            <CardDescription>
              {group.description ||
                "Configure standards and levels for this group."}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-6">
        {/* Group metadata editing */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`group-points-${group.id}`}>Points</Label>
            <Input
              id={`group-points-${group.id}`}
              type="number"
              value={group.points || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onGroupChange(group.id, { points: val });
              }}
              disabled={readonly}
              min="1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`group-pass-${group.id}`}>Pass Points</Label>
            <Input
              id={`group-pass-${group.id}`}
              type="number"
              value={group.passPoints || 0}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                onGroupChange(group.id, { passPoints: val });
              }}
              disabled={readonly}
              min="1"
            />
          </div>
        </div>

        {/* Standards/Levels section */}
        <div className="space-y-3 pt-4 border-t">
          <Label>Standards / Levels</Label>
          <div className="space-y-2">
            {groupStandards.map((standard) => (
              <div key={standard.id} className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Points"
                  value={standard.points}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    // Check if this point value is already used by another standard in this group
                    const otherStandards = groupStandards.filter(
                      (s) => s.id !== standard.id,
                    );
                    const isDuplicate = otherStandards.some(
                      (s) => s.points === val,
                    );
                    // Check if value exceeds group points
                    const exceedsMax = val > group.points;

                    if (!isDuplicate && !exceedsMax && val >= 1) {
                      onStandardsChange(
                        standards.map((s) =>
                          s.id === standard.id ? { ...s, points: val } : s,
                        ),
                      );
                    }
                  }}
                  disabled={readonly}
                  min="1"
                  max={group.points}
                  className="text-sm w-16"
                />
                <Input
                  placeholder="Level name (e.g., Excellent)"
                  value={standard.name}
                  onChange={(e) => {
                    onStandardsChange(
                      standards.map((s) =>
                        s.id === standard.id
                          ? { ...s, name: e.target.value }
                          : s,
                      ),
                    );
                  }}
                  disabled={readonly}
                  className="text-sm flex-1"
                />
                {!readonly && groupStandards.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveStandard(group.id, standard.id)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {groupStandards.length > 0 &&
            !readonly &&
            groupStandards.length < group.points && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onAddStandard(group.id)}
                >
                  <PlusCircle className="h-4 w-4 mr-2" /> Add Standard
                </Button>
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
