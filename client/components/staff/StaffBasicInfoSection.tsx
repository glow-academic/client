/**
 * StaffBasicInfoSection.tsx
 * Staff basic information section component
 */
"use client";
import { Clock, Power } from "lucide-react";
import { cn } from "@/lib/utils";

import { StaffDepartmentCardGrid } from "@/components/staff/StaffDepartmentCardGrid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface DepartmentItem {
  department_id: string;
  name: string;
  description: string;
}

export interface StaffBasicInfoSectionProps {
  // Data
  name: string;
  departmentIds: string[];
  primaryDepartmentId: string | undefined;
  validDepartmentIds: string[];
  departments: DepartmentItem[];  // Array of department objects (replaces departmentMapping)
  requestsPerDay: number | "";
  requestsPerDayEnabled: boolean;
  active: boolean;

  // Callbacks
  onNameChange: (value: string) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onPrimaryDepartmentIdChange: (id: string | undefined) => void;
  onRequestsPerDayChange: (value: number | "") => void;
  onRequestsPerDayEnabledChange: (enabled: boolean) => void;
  onActiveChange: (active: boolean) => void;

  // UI State
  isReadonly: boolean;
  isSubmitting: boolean;
}

export function StaffBasicInfoSection({
  name,
  departmentIds,
  primaryDepartmentId,
  validDepartmentIds,
  departments,
  requestsPerDay,
  requestsPerDayEnabled,
  active,
  onNameChange,
  onDepartmentIdsChange,
  onPrimaryDepartmentIdChange,
  onRequestsPerDayChange,
  onRequestsPerDayEnabledChange,
  onActiveChange,
  isReadonly,
  isSubmitting,
}: StaffBasicInfoSectionProps) {
  return (
    <div className="space-y-4">
      {/* Click-to-edit Name Section */}
      <div className="space-y-2">
        {/* Name - Required, Large */}
        <div>
          <input
            type="text"
            id="name"
            data-testid="input-staff-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className={cn(
              "w-full text-2xl font-semibold border-none outline-none bg-transparent px-2 py-1 hover:bg-muted/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:bg-muted/50 focus:ring-2 focus:ring-primary/20",
            )}
            placeholder="Name"
            required
            disabled={isReadonly || isSubmitting}
          />
          <p className="text-xs text-muted-foreground mt-1 px-2">
            {name === "" || !name
              ? "Click to edit • Name is required"
              : "Click to edit"}
          </p>
        </div>
      </div>
      {/* Departments Section */}
      <div className="space-y-2">
        <Label>Departments</Label>
        <StaffDepartmentCardGrid
          departmentIds={departmentIds}
          primaryDepartmentId={primaryDepartmentId}
          validDepartmentIds={validDepartmentIds}
          departments={departments}
          onDepartmentIdsChange={(ids) => {
            onDepartmentIdsChange(ids);
            // If primary department is not in the new list, clear it
            if (primaryDepartmentId && !ids.includes(primaryDepartmentId)) {
              onPrimaryDepartmentIdChange(ids.length > 0 ? ids[0] : undefined);
            }
          }}
          onPrimaryDepartmentIdChange={onPrimaryDepartmentIdChange}
          readonly={isReadonly || isSubmitting}
        />
      </div>

      {/* Requests Per Day Section */}
      <div className="space-y-2 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Label
              htmlFor="requestsPerDayEnabled"
              className="text-sm flex items-center gap-1.5"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              Requests per day
            </Label>
            <Switch
              id="requestsPerDayEnabled"
              checked={requestsPerDayEnabled}
              onCheckedChange={(checked) => {
                onRequestsPerDayEnabledChange(checked);
                if (!checked) {
                  onRequestsPerDayChange("");
                }
              }}
              disabled={isReadonly || isSubmitting}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Set a daily request limit for this staff member
          </p>
          {requestsPerDayEnabled && (
            <div className="space-y-2 pt-2">
              <Input
                id="reqPerDay"
                type="number"
                value={requestsPerDay === "" ? "" : String(requestsPerDay)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    onRequestsPerDayChange("");
                  } else {
                    const num = parseInt(val, 10);
                    onRequestsPerDayChange(Number.isNaN(num) ? "" : num);
                  }
                }}
                placeholder="e.g. 100"
                min={1}
                step={1}
                disabled={isReadonly || isSubmitting}
                data-testid="input-staff-requests-per-day"
              />
            </div>
          )}
        </div>
      </div>

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
              checked={active ?? true}
              onCheckedChange={(checked) => onActiveChange(checked)}
              disabled={isReadonly || isSubmitting}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-5">
            Whether this staff member is active
          </p>
        </div>
      </div>
    </div>
  );
}
