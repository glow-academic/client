/**
 * SettingsBasicInfoSection.tsx
 * Settings-specific basic information section component
 */
"use client";
import { Check, Power, UserPlus } from "lucide-react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { SettingsDetailOut } from "@/app/(main)/settings/page";

export interface SettingsBasicInfoSectionProps {
  // Data
  name: string;
  description: string;
  departmentIds: string[];
  validDepartmentIds: string[];
  departmentMapping: Record<
    string,
    { name: string; description: string }
  >;
  active: boolean;
  guestLoginEnabled: boolean;
  settingsList: SettingsDetailOut[];
  selectedSettingsId: string | null;
  settingsMapping: Record<string, SettingsDetailOut>;

  // Callbacks
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onActiveChange: (active: boolean) => void;
  onGuestLoginEnabledChange: (enabled: boolean) => void;
  onSettingsVersionSelect: (settingsId: string | null) => void;

  // UI State
  isReadonly: boolean;
  defaultName?: string;
}

export function SettingsBasicInfoSection({
  name,
  description,
  departmentIds,
  validDepartmentIds,
  departmentMapping,
  active,
  guestLoginEnabled,
  settingsList,
  selectedSettingsId,
  settingsMapping,
  onNameChange,
  onDescriptionChange,
  onDepartmentIdsChange,
  onActiveChange,
  onGuestLoginEnabledChange,
  onSettingsVersionSelect,
  isReadonly,
  defaultName = "Settings",
}: SettingsBasicInfoSectionProps) {
  const currentSetting = selectedSettingsId
    ? settingsMapping[selectedSettingsId]
    : null;

  return (
    <Card className="transition-all">
      <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-green-500 text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="text"
              data-testid="input-settings-name"
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
              {name === defaultName || !name
                ? "Click to edit • Name will be auto-generated if unchanged"
                : "Click to edit"}
            </p>
          </div>
        </div>
        {/* Version Picker */}
        {settingsList.length > 0 && (
          <div className="ml-4 shrink-0">
            <GenericPicker
              items={settingsMapping}
              itemIds={Object.keys(settingsMapping)}
              selectedIds={selectedSettingsId ? [selectedSettingsId] : []}
              onSelect={(ids) => onSettingsVersionSelect(ids[0] || null)}
              getId={(item) => (item as unknown as { id: string }).id}
              getLabel={(item) => {
                const date = new Date(item.created_at);
                return item.name || `Settings (${date.toLocaleDateString()})`;
              }}
              getSearchText={(item) => {
                const date = new Date(item.created_at);
                return `${item.name || "Settings"} ${item.description || ""} ${date.toLocaleDateString()} ${item.active ? "Active" : "Inactive"}`;
              }}
              renderButton={(selectedItems) => {
                if (selectedItems.length === 0) {
                  return "Select version...";
                }
                const setting = selectedItems[0];
                if (!setting) return "Select version...";
                const date = new Date(setting.created_at);
                const isDefault =
                  !setting.department_ids ||
                  setting.department_ids.length === 0;
                return (
                  <div className="flex items-center gap-2 truncate">
                    {isDefault && (
                      <Badge
                        variant="secondary"
                        className="text-xs h-5 px-1.5 flex-shrink-0"
                      >
                        Default
                      </Badge>
                    )}
                    <span className="truncate text-sm">
                      {setting.name || `Settings (${date.toLocaleDateString()})`}
                    </span>
                  </div>
                );
              }}
              renderItem={(item) => {
                const date = new Date(item.created_at);
                const isDefault =
                  !item.department_ids || item.department_ids.length === 0;
                return (
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isDefault && (
                          <Badge
                            variant="secondary"
                            className="text-xs h-5 px-1.5"
                          >
                            Default
                          </Badge>
                        )}
                        <div className="font-medium truncate">
                          {item.name || `Settings (${date.toLocaleDateString()})`}
                        </div>
                      </div>
                      {item.description && (
                        <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                          {item.description}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                        {date.toLocaleDateString()} • {item.active ? "Active" : "Inactive"}
                      </div>
                      {item.department_ids && item.department_ids.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.department_ids.length} department
                          {item.department_ids.length !== 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
              placeholder="Select version..."
              multiSelect={false}
              hideSelectedChips={true}
              buttonClassName="w-full min-w-[200px]"
              groupHeading="Settings Versions"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Settings description"
            disabled={isReadonly}
            className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 && (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <GenericPicker
              items={departmentMapping}
              itemIds={Array.from(
                new Set([...validDepartmentIds, ...(departmentIds || [])])
              )}
              selectedIds={departmentIds || []}
              onSelect={(ids) => onDepartmentIdsChange(ids)}
              getId={(dept) => {
                const entry = Object.entries(departmentMapping).find(
                  ([, v]) => v === dept
                );
                return entry ? entry[0] : "";
              }}
              getLabel={(dept) => (dept as { name: string }).name || ""}
              getSearchText={(dept) =>
                `${(dept as { name: string }).name} ${(dept as { description?: string }).description || ""}`
              }
              placeholder="All Departments"
              disabled={isReadonly}
              multiSelect={true}
              hideSelectedChips={true}
              buttonClassName="w-full"
            />
          </div>
        )}

        {/* Guest Login Enabled Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="guest_login_enabled"
                className="text-sm flex items-center gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                Allow Guest Login
              </Label>
              <Switch
                id="guest_login_enabled"
                checked={guestLoginEnabled}
                onCheckedChange={(checked) =>
                  onGuestLoginEnabledChange(checked)
                }
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Enable guest login functionality for the application
            </p>
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
                data-testid="switch-settings-active"
                checked={active ?? true}
                onCheckedChange={(checked) => onActiveChange(checked)}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Inactive settings will not be available for use
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

