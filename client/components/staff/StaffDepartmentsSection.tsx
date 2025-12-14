/**
 * StaffDepartmentsSection.tsx
 * Staff departments section component (multi-select with primary switch)
 */
"use client";
import { CheckCircle2, Trash2 } from "lucide-react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export interface DepartmentMappingItem {
  name: string;
  description: string;
}

export interface StaffDepartmentsSectionProps {
  // Data
  departmentIds: string[];
  primaryDepartmentIndex: number | undefined;
  validDepartmentIds: string[];
  departmentMapping: Record<string, DepartmentMappingItem>;

  // Callbacks
  onDepartmentIdsChange: (ids: string[]) => void;
  onPrimaryDepartmentIndexChange: (index: number | undefined) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffDepartmentsSection({
  departmentIds,
  primaryDepartmentIndex,
  validDepartmentIds,
  departmentMapping,
  onDepartmentIdsChange,
  onPrimaryDepartmentIndexChange,
  isReadonly,
  isSubmitting,
}: StaffDepartmentsSectionProps) {
  const removeDepartment = (deptId: string) => {
    const index = departmentIds.indexOf(deptId);
    const newIds = departmentIds.filter((id) => id !== deptId);
    onDepartmentIdsChange(newIds);

    // Adjust primary index if needed
    if (primaryDepartmentIndex !== undefined) {
      if (index === primaryDepartmentIndex) {
        // If removing primary, set first department as primary (or undefined if none)
        onPrimaryDepartmentIndexChange(
          newIds.length > 0 ? 0 : undefined,
        );
      } else if (index < primaryDepartmentIndex) {
        // If removing before primary, adjust index
        onPrimaryDepartmentIndexChange(primaryDepartmentIndex - 1);
      }
    }
  };

  const setPrimaryDepartment = (index: number) => {
    onPrimaryDepartmentIndexChange(index);
  };

  return (
    <Card className="transition-all">
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2">
          <Label>Departments</Label>
          <GenericPicker
            items={departmentMapping}
            itemIds={validDepartmentIds}
            selectedIds={departmentIds}
            onSelect={(ids) => {
              onDepartmentIdsChange(ids);
              // Set first department as primary if none selected
              if (
                ids.length > 0 &&
                (primaryDepartmentIndex === undefined ||
                  primaryDepartmentIndex >= ids.length)
              ) {
                onPrimaryDepartmentIndexChange(0);
              } else if (ids.length === 0) {
                onPrimaryDepartmentIndexChange(undefined);
              }
            }}
            getId={(dept) => (dept as unknown as { id: string }).id}
            getLabel={(dept) => dept.name || ""}
            getSearchText={(dept) =>
              `${dept.name} ${dept.description || ""}`
            }
            placeholder="Select departments"
            disabled={isReadonly || isSubmitting}
            multiSelect={true}
            hideSelectedChips={true}
            buttonClassName="w-full"
          />
          {departmentIds.length > 0 && (
            <div className="space-y-2 pt-2">
              <Label className="text-sm">Selected Departments</Label>
              <div className="space-y-1">
                {departmentIds.map((deptId, index) => {
                  const dept = departmentMapping[deptId];
                  if (!dept) return null;
                  const isPrimary = index === primaryDepartmentIndex;
                  return (
                    <div
                      key={deptId}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-medium truncate">{dept.name}</div>
                          {isPrimary && (
                            <span className="text-xs text-primary font-medium">
                              Primary
                            </span>
                          )}
                        </div>
                        {dept.description && (
                          <div className="text-sm text-muted-foreground truncate">
                            {dept.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant={isPrimary ? "default" : "outline"}
                          size="icon"
                          onClick={() => setPrimaryDepartment(index)}
                          disabled={
                            isReadonly ||
                            isSubmitting ||
                            isPrimary
                          }
                          className="h-8 w-8 shrink-0"
                          title="Set as primary"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeDepartment(deptId)}
                          disabled={isReadonly || isSubmitting}
                          className="h-8 w-8 shrink-0"
                          title="Remove department"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

