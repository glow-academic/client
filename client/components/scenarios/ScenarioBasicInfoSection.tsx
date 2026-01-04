/**
 * ScenarioBasicInfoSection.tsx
 * Scenario-specific basic information section component
 */
"use client";
import { Check, Power, RotateCcw, Video } from "lucide-react";
import { useEffect, useState } from "react";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { components } from "@/lib/api/schema";

type AgentMappingItem =
  components["schemas"]["QGetScenarioDetailV4Agent"];
type DepartmentMappingItem =
  components["schemas"]["QGetScenarioDetailV4Department"];

export interface ScenarioBasicInfoSectionProps {
  // Data
  name: string;
  departmentIds: string[];
  validDepartmentIds: string[];
  departmentMapping: Record<string, DepartmentMappingItem>;
  initialScenarioAgentId?: string | null;
  initialImageAgentId?: string | null;
  initialVideoAgentId?: string | null;
  validAgentIds: string[];
  agentMapping: Record<string, AgentMappingItem>;
  initialActive?: boolean;
  useVideo: boolean;

  // Callbacks
  onNameChange: (name: string) => void;
  onDepartmentIdsChange: (ids: string[]) => void;
  onUseVideoChange: (enabled: boolean) => void;
  onRandomizeAll: () => void;
  onResetAll: () => void;
  onStateChange?: (state: {
    scenarioAgentId: string | null;
    imageAgentId: string | null;
    videoAgentId: string | null;
    active: boolean;
  }) => void;

  // UI State
  isReadonly: boolean;
  defaultName?: string;
  activeLabel?: string;
  activeDescription?: string;
}

export function ScenarioBasicInfoSection({
  name,
  departmentIds,
  validDepartmentIds,
  departmentMapping,
  initialScenarioAgentId = null,
  initialImageAgentId = null,
  initialVideoAgentId = null,
  validAgentIds,
  agentMapping,
  initialActive = true,
  useVideo,
  onNameChange,
  onDepartmentIdsChange,
  onUseVideoChange,
  onRandomizeAll,
  onResetAll,
  onStateChange,
  isReadonly,
  defaultName = "New Scenario",
  activeLabel = "Active",
  activeDescription = "Inactive scenarios will not be available for other simulations",
}: ScenarioBasicInfoSectionProps) {
  // Internal state for agent IDs and active
  const [scenarioAgentId, setScenarioAgentId] = useState<string | null>(
    initialScenarioAgentId ?? null
  );
  const [imageAgentId, setImageAgentId] = useState<string | null>(
    initialImageAgentId ?? null
  );
  const [videoAgentId, setVideoAgentId] = useState<string | null>(
    initialVideoAgentId ?? null
  );
  const [active, setActive] = useState<boolean>(initialActive ?? true);

  // Initialize from props when they change (for edit mode)
  useEffect(() => {
    if (initialScenarioAgentId !== undefined) {
      setScenarioAgentId(initialScenarioAgentId);
    }
  }, [initialScenarioAgentId]);

  useEffect(() => {
    if (initialImageAgentId !== undefined) {
      setImageAgentId(initialImageAgentId);
    }
  }, [initialImageAgentId]);

  useEffect(() => {
    if (initialVideoAgentId !== undefined) {
      setVideoAgentId(initialVideoAgentId);
    }
  }, [initialVideoAgentId]);

  useEffect(() => {
    if (initialActive !== undefined) {
      setActive(initialActive);
    }
  }, [initialActive]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.({
      scenarioAgentId,
      imageAgentId,
      videoAgentId,
      active,
    });
  }, [scenarioAgentId, imageAgentId, videoAgentId, active, onStateChange]);
  // Filter agents by 'scenario' role only
  const filteredScenarioAgentIds =
    validAgentIds?.filter((id) => {
      const agent = agentMapping[id];
      // Include only agents with 'scenario' role
      return agent?.roles?.includes("scenario");
    }) || [];

  const imageAgentIds =
    validAgentIds?.filter((id) => {
      const agent = agentMapping[id];
      return agent?.roles?.includes("image");
    }) || [];

  const videoAgentIds =
    validAgentIds?.filter((id) => {
      const agent = agentMapping[id];
      return agent?.roles?.includes("video");
    }) || [];

  // TODO: Temporarily showing agent sections to debug which agent is being selected
  // TODO: Revert to only showing when there's more than one option after debugging
  // Only show agent pickers if there's more than one option
  // const showScenarioPicker = filteredScenarioAgentIds.length > 1;
  // const showImagePicker = imageAgentIds.length > 1;
  // const showVideoPicker = videoAgentIds.length > 1;

  // TEMPORARY: Show sections even with single option to see which agent is selected
  const showScenarioPicker = filteredScenarioAgentIds.length > 0;
  const showImagePicker = imageAgentIds.length > 0;
  const showVideoPicker = videoAgentIds.length > 0;

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
              data-testid="input-scenario-title"
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
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onRandomizeAll}
              disabled={isReadonly}
            >
              Randomize All
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onResetAll}
                  disabled={isReadonly}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset All</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardContent>
      <CardContent className="pt-0 space-y-4">
        {/* Department Selection */}
        {validDepartmentIds && validDepartmentIds.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            {departmentIds !== undefined ? (
              <GenericPicker
                items={departmentMapping}
                itemIds={Array.from(
                  new Set([...validDepartmentIds, ...(departmentIds || [])])
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

        {/* Agent Selection */}
        {(showScenarioPicker || showImagePicker || showVideoPicker) && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* Scenario Agent Selection */}
            {showScenarioPicker && (
              <div className="space-y-2">
                <Label htmlFor="scenarioAgentId">Scenario Agent</Label>
                {scenarioAgentId !== undefined ? (
                  <GenericPicker
                    items={agentMapping}
                    itemIds={filteredScenarioAgentIds}
                    selectedIds={scenarioAgentId ? [scenarioAgentId] : []}
                    onSelect={(ids) => setScenarioAgentId(ids[0] || null)}
                    getId={(item) => (item as unknown as { id: string }).id}
                    getLabel={(item) => item.name || ""}
                    getSearchText={(item) =>
                      `${item.name} ${item.description || ""}`
                    }
                    renderPreview={(item) => (
                      <div className="grid gap-2">
                        <h4 className="font-medium leading-none">
                          {item.name || "No agent selected"}
                        </h4>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "No description available"}
                        </div>
                      </div>
                    )}
                    renderItem={(item, _isSelected) => (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    placeholder="Select scenario agent"
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agents"
                  />
                ) : null}
              </div>
            )}

            {/* Image Agent Selection */}
            {showImagePicker && (
              <div className="space-y-2">
                <Label htmlFor="imageAgentId">Image Agent</Label>
                {imageAgentId !== undefined ? (
                  <GenericPicker
                    items={agentMapping}
                    itemIds={imageAgentIds}
                    selectedIds={imageAgentId ? [imageAgentId] : []}
                    onSelect={(ids) => setImageAgentId(ids[0] || null)}
                    getId={(item) => (item as unknown as { id: string }).id}
                    getLabel={(item) => item.name || ""}
                    getSearchText={(item) =>
                      `${item.name} ${item.description || ""}`
                    }
                    renderPreview={(item) => (
                      <div className="grid gap-2">
                        <h4 className="font-medium leading-none">
                          {item.name || "No agent selected"}
                        </h4>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "No description available"}
                        </div>
                      </div>
                    )}
                    renderItem={(item, _isSelected) => (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    placeholder="Select image agent"
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agents"
                  />
                ) : null}
              </div>
            )}

            {/* Video Agent Selection */}
            {showVideoPicker && (
              <div className="space-y-2">
                <Label htmlFor="videoAgentId">Video Agent</Label>
                {videoAgentId !== undefined ? (
                  <GenericPicker
                    items={agentMapping}
                    itemIds={videoAgentIds}
                    selectedIds={videoAgentId ? [videoAgentId] : []}
                    onSelect={(ids) => setVideoAgentId(ids[0] || null)}
                    getId={(item) => (item as unknown as { id: string }).id}
                    getLabel={(item) => item.name || ""}
                    getSearchText={(item) =>
                      `${item.name} ${item.description || ""}`
                    }
                    renderPreview={(item) => (
                      <div className="grid gap-2">
                        <h4 className="font-medium leading-none">
                          {item.name || "No agent selected"}
                        </h4>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "No description available"}
                        </div>
                      </div>
                    )}
                    renderItem={(item, _isSelected) => (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-1 truncate group-data-[selected=true]:text-primary-foreground group-data-[highlighted=true]:text-primary-foreground">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    placeholder="Select video agent"
                    disabled={isReadonly}
                    multiSelect={false}
                    hideSelectedChips={true}
                    buttonClassName="w-full"
                    groupHeading="Agents"
                  />
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* Active Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="active"
                className="text-sm flex items-center gap-1.5"
              >
                <Power className="h-3.5 w-3.5 text-muted-foreground" />
                {activeLabel}
              </Label>
              <Switch
                id="active"
                data-testid="switch-scenario-active"
                checked={active ?? true}
                onCheckedChange={(checked) => setActive(checked)}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              {activeDescription}
            </p>
          </div>
        </div>

        {/* Use Video Switch */}
        <div className="space-y-2 pt-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Label
                htmlFor="use-video"
                className="text-sm flex items-center gap-1.5"
              >
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
                Video
              </Label>
              <Switch
                id="use-video"
                checked={useVideo}
                onCheckedChange={(checked) => onUseVideoChange(checked)}
                disabled={isReadonly}
              />
            </div>
            <p className="text-xs text-muted-foreground pl-5">
              Use video instead of chat interface
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
