/**
 * DocumentBasicInfoSection.tsx
 * Document-specific basic information section component
 */
"use client";
import { Check, FileCode, Power } from "lucide-react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { components } from "@/lib/api/schema";

type DepartmentMappingItem =
  components["schemas"]["app__api__v3__documents__detail__DepartmentMappingItem"];

export interface DocumentBasicInfoSectionProps {
  // Data
  name: string;
  description: string;
  departmentIds: string[];
  validDepartmentIds: string[];
  departmentMapping: Record<string, DepartmentMappingItem>;
  active: boolean;
  isTemplate: boolean;

  // Callbacks
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onActiveChange: (active: boolean) => void;
  onTemplateChange: (isTemplate: boolean) => void;

  // UI State
  isReadonly: boolean;
  defaultName?: string;
}

export function DocumentBasicInfoSection({
  name,
  description,
  departmentIds,
  validDepartmentIds,
  departmentMapping,
  active,
  isTemplate,
  onNameChange,
  onDescriptionChange,
  onDepartmentIdsChange,
  onActiveChange,
  onTemplateChange,
  isReadonly,
  defaultName = "New Document",
}: DocumentBasicInfoSectionProps) {
  return (
    <Card className="transition-all">
      <CardContent className="pt-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <input
              type="text"
              data-testid="input-document-name"
              value={name || ""}
              onChange={(e) => onNameChange(e.target.value)}
              onFocus={(e) => {
                if (e.target.value === defaultName) {
                  e.target.select();
                }
              }}
              onBlur={(e) => {
                // If empty on blur, revert to default name
                if (!e.target.value || e.target.value.trim() === "") {
                  onNameChange(defaultName);
                }
              }}
              className="w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20"
              placeholder={defaultName}
              disabled={isReadonly}
            />
            <p className="text-xs text-muted-foreground mt-1 px-2">
              Click to edit
            </p>
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0 space-y-4">
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            data-testid="input-document-description"
            value={description || ""}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Enter a brief description (optional)"
            rows={3}
            disabled={isReadonly}
          />
        </div>

        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {departmentIds !== undefined ? (
              <GenericPicker
                items={departmentMapping}
                itemIds={Array.from(
                  new Set([...validDepartmentIds, ...(departmentIds || [])]),
                )}
                selectedIds={departmentIds || []}
                onSelect={(ids) => onDepartmentIdsChange(ids)}
                getId={(dept) => (dept as unknown as { id: string }).id}
                getLabel={(dept) => dept.name || ""}
                getSearchText={(dept) =>
                  `${dept.name} ${dept.description || ""}`
                }
                placeholder="All Departments"
                disabled={isReadonly}
                multiSelect={true}
                hideSelectedChips={true}
                buttonClassName="w-full"
              />
            ) : null}
          </div>
        ) : null}

        {/* Active Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="active"
                className="text-sm flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                Active
              </Label>
              <Switch
                id="active"
                data-testid="switch-document-active"
                checked={active ?? true}
                onCheckedChange={(checked) => onActiveChange(checked)}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive documents will not be available for use in scenarios or
              simulations
            </p>
          </div>
        </div>

        {/* Template Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="template"
                className="text-sm flex items-center gap-1.5"
              >
                <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
                Template
              </Label>
              <Switch
                id="template"
                data-testid="switch-document-template"
                checked={isTemplate}
                onCheckedChange={(checked) => onTemplateChange(checked)}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Template documents can be dynamically rendered with variable
              arguments for personalized content generation
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
