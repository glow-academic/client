/**
 * DashboardEdit.tsx
 * This component is used to display the dashboard edit page.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboard } from "@/contexts/dashboard-context";
import { Dashboard } from "@/types";
import { logError } from "@/utils/logger";
import { updateComponent } from "@/utils/mutations/components/update-component";
import { createDashboard } from "@/utils/mutations/dashboards/create-dashboard";
import { updateDashboard } from "@/utils/mutations/dashboards/update-dashboard";
import { getAllComponents } from "@/utils/queries/components/get-all-components";
import { getAllDashboards } from "@/utils/queries/dashboards/get-all-dashboards";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelRightClose, PanelRightOpen, RotateCcw } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import CarouselSection from "./CarouselSection";
import DraggableComponent from "./DraggableComponent";
import DropZone from "./DropZone";
import FooterPreview from "./FooterPreview";
import HeaderPreview from "./HeaderPreview";
import SettingsDialog from "./SettingsDialog";

interface DashboardComponent {
  id: string;
  name: string;
  fileName: string;
  layout: Record<string, unknown>;
  stat?: boolean;
}

export default function DashboardEdit() {
  const { setIsEditMode } = useDashboard();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // Local state for dashboard editing
  const [dashboardConfig, setDashboardConfig] =
    useState<Partial<Dashboard> | null>(null);
  const [originalDashboardConfig, setOriginalDashboardConfig] =
    useState<Partial<Dashboard> | null>(null);
  const [availableComponents, setAvailableComponents] = useState<
    DashboardComponent[]
  >([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: components } = useQuery({
    queryKey: ["components"],
    queryFn: () => getAllComponents(),
  });

  const { data: userProfile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
  });

  const { data: dashboards } = useQuery({
    queryKey: ["dashboards"],
    queryFn: () => getAllDashboards(),
  });

  // Initialize dashboard config from loaded data
  useMemo(() => {
    if (!dashboards || !userProfile || dashboardConfig) return;

    let dashboard = dashboards.find((d) => d.profileId === userProfile.id);
    if (!dashboard) {
      dashboard = dashboards.find((d) => d.profileId === null);
    }

    if (dashboard) {
      const config = {
        id: dashboard.id,
        headerComponentIds: dashboard.headerComponentIds || [],
        primaryComponentIds: dashboard.primaryComponentIds || [],
        secondaryComponentIds: dashboard.secondaryComponentIds || [],
        footerComponentIds: dashboard.footerComponentIds || [],
        autoScroll: dashboard.autoScroll || false,
        showIndicators: dashboard.showIndicators || false,
        headerComponents: dashboard.headerComponents || 4,
        mainSplit: dashboard.mainSplit || 0.75,
        footerSplit: dashboard.footerSplit || 0.5,
      };

      setDashboardConfig(config);
      setOriginalDashboardConfig(config);
    }
  }, [dashboards, userProfile, dashboardConfig]);

  // Calculate available components
  const availableComponentsData = useMemo(() => {
    if (!components || !dashboardConfig) return [];

    const isValidUUID = (uuid: string) => {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(uuid);
    };

    const usedComponentIds = [
      ...(dashboardConfig.headerComponentIds ?? []).filter(
        (id) => id && isValidUUID(id)
      ),
      ...(dashboardConfig.primaryComponentIds ?? []).filter(
        (id) => id && isValidUUID(id)
      ),
      ...(dashboardConfig.secondaryComponentIds ?? []).filter(
        (id) => id && isValidUUID(id)
      ),
      ...(dashboardConfig.footerComponentIds ?? []).filter(
        (id) => id && isValidUUID(id)
      ),
    ];

    return components
      .filter((comp) => !usedComponentIds.includes(comp.id))
      .map((comp) => ({
        id: comp.id,
        name: comp.name,
        fileName: comp.fileName,
        layout: (comp.layout as Record<string, unknown>) || {},
        stat: comp.stat,
      }));
  }, [components, dashboardConfig]);

  // Update available components when data changes
  useEffect(() => {
    setAvailableComponents(availableComponentsData);
  }, [availableComponentsData]);

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    if (!dashboardConfig || !originalDashboardConfig) return false;
    return (
      JSON.stringify(dashboardConfig) !==
      JSON.stringify(originalDashboardConfig)
    );
  }, [dashboardConfig, originalDashboardConfig]);

  // Check if current dashboard is global
  const isGlobalDashboard = useMemo(() => {
    if (!dashboards || !dashboardConfig) return false;
    const currentDashboard = dashboards.find(
      (d) => d.id === dashboardConfig.id
    );
    return currentDashboard?.profileId === null;
  }, [dashboards, dashboardConfig]);

  // Component management functions
  const addComponentToSection = useCallback(
    (componentId: string, section: string) => {
      if (!dashboardConfig) return;

      // Remove from available components
      setAvailableComponents((prev) =>
        prev.filter((comp) => comp.id !== componentId)
      );

      // Add to section
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: [
            ...(prev[section as keyof Partial<Dashboard>] as string[]),
            componentId,
          ],
        };
      });
      // No auto-save - only save when user clicks "Save Changes"
    },
    [dashboardConfig]
  );

  const removeComponentFromSection = useCallback(
    (componentId: string, section: string) => {
      if (!dashboardConfig) return;

      // Find the component to add back to available
      const component = components?.find((comp) => comp.id === componentId);
      if (component) {
        setAvailableComponents((prev) => [
          ...prev,
          {
            id: component.id,
            name: component.name,
            fileName: component.fileName,
            layout: (component.layout as Record<string, unknown>) || {},
            stat: component.stat,
          },
        ]);
      }

      // Remove from section
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: (
            prev[section as keyof Partial<Dashboard>] as string[]
          ).filter((id) => id !== componentId),
        };
      });
      // No auto-save - only save when user clicks "Save Changes"
    },
    [dashboardConfig, components]
  );

  const moveComponent = useCallback(
    (
      componentId: string,
      fromSection: string,
      toSection: string,
      toIndex?: number
    ) => {
      if (!dashboardConfig) return;

      setDashboardConfig((prev) => {
        if (!prev) return prev;

        const newConfig = { ...prev };
        const fromArray = [
          ...(newConfig[fromSection as keyof Partial<Dashboard>] as string[]),
        ];
        const toArray = [
          ...(newConfig[toSection as keyof Partial<Dashboard>] as string[]),
        ];

        // Remove from source
        const itemIndex = fromArray.findIndex((id) => id === componentId);
        if (itemIndex >= 0) {
          fromArray.splice(itemIndex, 1);
        }

        // Add to destination
        if (toIndex !== undefined) {
          toArray.splice(toIndex, 0, componentId);
        } else {
          toArray.push(componentId);
        }

        return {
          ...newConfig,
          [fromSection]: fromArray,
          [toSection]: toArray,
        };
      });
      // No auto-save - only save when user clicks "Save Changes"
    },
    [dashboardConfig]
  );

  const updateSettings = useCallback(
    (
      settings: Partial<
        Pick<
          Partial<Dashboard>,
          | "autoScroll"
          | "showIndicators"
          | "headerComponents"
          | "mainSplit"
          | "footerSplit"
        >
      >
    ) => {
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return { ...prev, ...settings };
      });
    },
    []
  );

  // Save changes function
  const saveChanges = useCallback(async () => {
    if (!dashboardConfig || !session?.user?.id || !userProfile) return;

    setIsSaving(true);
    try {
      if (isGlobalDashboard) {
        // Create a new personal dashboard
        const personalDashboard = {
          ...dashboardConfig,
          profileId: userProfile.id,
        };

        // delete the id key
        delete personalDashboard.id;

        await createDashboard(personalDashboard);

        toast.success("Personal dashboard created successfully", {
          description:
            "Your changes have been saved to your personal dashboard",
        });
      } else {
        // Update existing personal dashboard
        await updateDashboard(dashboardConfig.id!, dashboardConfig);

        toast.success("Dashboard updated successfully");
      }

      // Update original config to reset change tracking
      setOriginalDashboardConfig({ ...dashboardConfig });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });

      // Exit edit mode
      setIsEditMode(false);
    } catch (error) {
      logError("Failed to save dashboard", error);
      toast.error("Failed to save dashboard");
    } finally {
      setIsSaving(false);
    }
  }, [
    dashboardConfig,
    session?.user?.id,
    userProfile,
    isGlobalDashboard,
    queryClient,
    setIsEditMode,
  ]);

  // Create lookup for all components
  const allComponentsLookup = useMemo(() => {
    const lookup = availableComponents.reduce(
      (acc, comp) => {
        acc[comp.id] = comp;
        return acc;
      },
      {} as {
        [key: string]: {
          id: string;
          name: string;
          fileName: string;
          stat?: boolean;
        };
      }
    );

    // Add components that are currently in use to the lookup
    if (dashboardConfig) {
      const allUsedComponents = [
        ...(dashboardConfig.headerComponentIds ?? []),
        ...(dashboardConfig.primaryComponentIds ?? []),
        ...(dashboardConfig.secondaryComponentIds ?? []),
        ...(dashboardConfig.footerComponentIds ?? []),
      ];

      allUsedComponents.forEach((id) => {
        const component = components?.find((comp) => comp.id === id);
        if (!lookup[id] && component) {
          lookup[id] = {
            id,
            name: component.name,
            fileName: component.fileName,
            stat: component.stat,
          };
        }
      });
    }

    return lookup;
  }, [availableComponents, dashboardConfig, components]);

  const handleDrop = useCallback(
    (componentId: string, toSection: string) => {
      const isFromSidebar = availableComponents.some(
        (comp) => comp.id === componentId
      );

      if (isFromSidebar) {
        addComponentToSection(componentId, toSection);
      } else {
        if (!dashboardConfig) return;

        let fromSection = "";
        if (dashboardConfig.headerComponentIds?.includes(componentId))
          fromSection = "headerComponentIds";
        else if (dashboardConfig.primaryComponentIds?.includes(componentId))
          fromSection = "primaryComponentIds";
        else if (dashboardConfig.secondaryComponentIds?.includes(componentId))
          fromSection = "secondaryComponentIds";
        else if (dashboardConfig.footerComponentIds?.includes(componentId))
          fromSection = "footerComponentIds";

        if (fromSection && fromSection !== toSection) {
          moveComponent(componentId, fromSection, toSection);
        }
      }
      // Changes will only be saved when user clicks "Save Changes"
    },
    [availableComponents, dashboardConfig, addComponentToSection, moveComponent]
  );

  const handleRemove = useCallback(
    (componentId: string, section: string) => {
      removeComponentFromSection(componentId, section);
      // Changes will only be saved when user clicks "Save Changes"
    },
    [removeComponentFromSection]
  );

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number, section = "headerComponentIds") => {
      if (!dashboardConfig) return;

      const sectionArray = dashboardConfig[
        section as keyof Pick<
          Partial<Dashboard>,
          | "headerComponentIds"
          | "primaryComponentIds"
          | "secondaryComponentIds"
          | "footerComponentIds"
        >
      ] as string[];

      const newArray = [...sectionArray];
      const [movedItem] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, movedItem!);

      setDashboardConfig({
        ...dashboardConfig,
        [section]: newArray,
      });
      // Changes will only be saved when user clicks "Save Changes"
    },
    [dashboardConfig, setDashboardConfig]
  );

  const handleMainResizeEnd = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        const mainSplit = sizes[0] ? sizes[0] / 100 : 0.65;
        updateSettings({ mainSplit });
      }
      // Changes will only be saved when user clicks "Save Changes"
    },
    [updateSettings]
  );

  const handleFooterResizeEnd = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        const footerSplit = sizes[0] ? sizes[0] / 100 : 0.5;
        updateSettings({ footerSplit });
      }
      // Changes will only be saved when user clicks "Save Changes"
    },
    [updateSettings]
  );

  // Reset to global settings function
  const resetToGlobalSettings = useCallback(() => {
    if (!dashboards || !components) return;

    const globalDashboard = dashboards.find((d) => d.profileId === null);
    if (!globalDashboard) {
      toast.error("No global dashboard found");
      return;
    }

    const globalConfig: Partial<Dashboard> = {
      ...(dashboardConfig?.id && { id: dashboardConfig.id }), // Only include id if it exists
      headerComponentIds: globalDashboard.headerComponentIds || [],
      primaryComponentIds: globalDashboard.primaryComponentIds || [],
      secondaryComponentIds: globalDashboard.secondaryComponentIds || [],
      footerComponentIds: globalDashboard.footerComponentIds || [],
      autoScroll: globalDashboard.autoScroll || false,
      showIndicators: globalDashboard.showIndicators || false,
      headerComponents: globalDashboard.headerComponents || 4,
      mainSplit: globalDashboard.mainSplit || 0.75,
      footerSplit: globalDashboard.footerSplit || 0.5,
    };

    setDashboardConfig(globalConfig);

    // Update available components based on new config
    const usedComponentIds = [
      ...(globalConfig.headerComponentIds ?? []),
      ...(globalConfig.primaryComponentIds ?? []),
      ...(globalConfig.secondaryComponentIds ?? []),
      ...(globalConfig.footerComponentIds ?? []),
    ];

    const newAvailableComponents = components
      .filter((comp) => !usedComponentIds.includes(comp.id))
      .map((comp) => ({
        id: comp.id,
        name: comp.name,
        fileName: comp.fileName,
        layout: (comp.layout as Record<string, unknown>) || {},
        stat: comp.stat,
      }));

    setAvailableComponents(newAvailableComponents);

    toast.success("Applied default dashboard settings");
  }, [dashboards, components, dashboardConfig?.id]);

  // Handle layout updates
  const handleUpdateLayout = useCallback(
    async (componentId: string, layout: Record<string, unknown>) => {
      try {
        await updateComponent(componentId, { layout });

        // Update local state
        setAvailableComponents((prev) =>
          prev.map((comp) =>
            comp.id === componentId ? { ...comp, layout } : comp
          )
        );

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["components"] });
      } catch (error) {
        logError("Failed to update component layout", error);
        toast.error("Failed to update component layout");
      }
    },
    [queryClient]
  );

  if (!dashboardConfig) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Main Edit Area */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={sidebarOpen ? 67 : 100} minSize={50}>
          <div className="h-full flex flex-col">
            {/* Header with action buttons */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <h1 className="font-semibold text-lg">Dashboard Editor</h1>
              <div className="flex items-center gap-2">
                <Button
                  onClick={saveChanges}
                  disabled={!hasChanges || isSaving}
                  variant={!hasChanges || isSaving ? "outline" : "default"}
                  size="sm"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>

                {/* Settings Button - always visible */}
                <SettingsDialog
                  dashboardConfig={dashboardConfig}
                  updateSettings={updateSettings}
                />

                {/* Reset to Global Button */}
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!dashboards || isGlobalDashboard}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Reset</p>
                    </TooltipContent>
                  </Tooltip>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reset to Default Settings</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to apply the default dashboard
                        settings?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button onClick={resetToGlobalSettings}>Apply</Button>
                      </DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Panel Toggle Button - always visible */}
                {!sidebarOpen && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                      >
                        <PanelRightOpen className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open Panel</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-auto">
              <div className="space-y-6">
                {/* Header Section with Reordering */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Header Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HeaderPreview
                      components={dashboardConfig.headerComponentIds ?? []}
                      allComponents={allComponentsLookup}
                      headerComponents={dashboardConfig.headerComponents ?? 4}
                      showIndicators={dashboardConfig.showIndicators ?? false}
                      autoScroll={dashboardConfig.autoScroll ?? false}
                      onRemove={(componentId) =>
                        handleRemove(componentId, "headerComponentIds")
                      }
                      onUpdateLayout={handleUpdateLayout}
                      onReorder={(fromIndex, toIndex) =>
                        handleReorder(fromIndex, toIndex, "headerComponentIds")
                      }
                    />

                    {/* Drop zone for adding new components */}
                    <div className="mt-4 pt-4 border-t">
                      <DropZone
                        section="headerComponentIds"
                        title="Add Header Components"
                        components={[]}
                        allComponents={allComponentsLookup}
                        onDrop={handleDrop}
                        onRemove={handleRemove}
                        onUpdateLayout={handleUpdateLayout}
                        className="min-h-20"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Main Content Section with Resizable Panels */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Main Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResizablePanelGroup
                      direction="horizontal"
                      onLayout={handleMainResizeEnd}
                      className="min-h-64"
                    >
                      <ResizablePanel
                        defaultSize={(dashboardConfig.mainSplit ?? 0.75) * 100}
                        minSize={30}
                      >
                        <div className="h-full mr-3">
                          <h4 className="font-medium text-sm text-muted-foreground mb-3">
                            Primary Section
                          </h4>
                          <CarouselSection
                            components={
                              dashboardConfig.primaryComponentIds ?? []
                            }
                            allComponents={allComponentsLookup}
                            showIndicators={
                              dashboardConfig.showIndicators ?? false
                            }
                            autoScroll={dashboardConfig.autoScroll ?? false}
                            onRemove={(componentId) =>
                              handleRemove(componentId, "primaryComponentIds")
                            }
                            onUpdateLayout={handleUpdateLayout}
                            interval={5000}
                          />

                          {/* Drop zone */}
                          <div className="mt-4">
                            <DropZone
                              section="primaryComponentIds"
                              title="Add Primary Components"
                              components={[]}
                              allComponents={allComponentsLookup}
                              onDrop={handleDrop}
                              onRemove={handleRemove}
                              onUpdateLayout={handleUpdateLayout}
                              className="min-h-16"
                            />
                          </div>
                        </div>
                      </ResizablePanel>

                      <ResizableHandle withHandle />

                      <ResizablePanel
                        defaultSize={
                          (1 - (dashboardConfig.mainSplit ?? 0.75)) * 100
                        }
                        minSize={20}
                      >
                        <div className="h-full ml-3">
                          <h4 className="font-medium text-sm text-muted-foreground mb-3">
                            Secondary Section
                          </h4>
                          <CarouselSection
                            components={
                              dashboardConfig.secondaryComponentIds ?? []
                            }
                            allComponents={allComponentsLookup}
                            showIndicators={
                              dashboardConfig.showIndicators ?? false
                            }
                            autoScroll={dashboardConfig.autoScroll ?? false}
                            onRemove={(componentId) =>
                              handleRemove(componentId, "secondaryComponentIds")
                            }
                            onUpdateLayout={handleUpdateLayout}
                            interval={4000}
                          />

                          {/* Drop zone */}
                          <div className="mt-4">
                            <DropZone
                              section="secondaryComponentIds"
                              title="Add Secondary Components"
                              components={[]}
                              allComponents={allComponentsLookup}
                              onDrop={handleDrop}
                              onRemove={handleRemove}
                              onUpdateLayout={handleUpdateLayout}
                              className="min-h-16"
                            />
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </CardContent>
                </Card>

                {/* Footer Section with Resizable Panels and Interleaved Components */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Footer Content
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FooterPreview
                      components={dashboardConfig.footerComponentIds ?? []}
                      allComponents={allComponentsLookup}
                      showIndicators={dashboardConfig.showIndicators ?? false}
                      autoScroll={dashboardConfig.autoScroll ?? false}
                      footerSplit={dashboardConfig.footerSplit ?? 0.5}
                      onRemove={(componentId) =>
                        handleRemove(componentId, "footerComponentIds")
                      }
                      onUpdateLayout={handleUpdateLayout}
                      onResizeEnd={handleFooterResizeEnd}
                    />

                    {/* Single drop zone for footer components */}
                    <div className="mt-4 pt-4 border-t">
                      <DropZone
                        section="footerComponentIds"
                        title="Add Footer Components"
                        components={[]}
                        allComponents={allComponentsLookup}
                        onDrop={handleDrop}
                        onRemove={handleRemove}
                        onUpdateLayout={handleUpdateLayout}
                        className="min-h-20"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ResizablePanel>

        {/* Sidebar */}
        {sidebarOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={33} minSize={20} maxSize={50}>
              <div className="h-full border-l bg-muted/30 flex flex-col">
                <div className="p-4 border-b bg-background">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Components</h2>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSidebarOpen(!sidebarOpen)}
                        >
                          <PanelRightClose className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Close Panel</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-auto">
                  <div className="space-y-3">
                    {availableComponents.length > 0 ? (
                      availableComponents.map((component) => (
                        <DraggableComponent
                          key={component.id}
                          component={component}
                          isInSidebar
                          onUpdateLayout={handleUpdateLayout}
                        />
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        <p>No available components</p>
                        <p className="text-xs mt-2">
                          All components are currently in use on the dashboard
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
