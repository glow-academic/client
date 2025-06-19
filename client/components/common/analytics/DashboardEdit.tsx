/**
 * DashboardEdit.tsx
 * Used to edit the dashboard for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useDashboard } from "@/contexts/dashboard-context";
import { cn } from "@/lib/utils";
import { Minus, PanelRightClose, Settings, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface DashboardConfig {
  id: string;
  headerComponentIds: string[];
  primaryComponentIds: string[];
  secondaryComponentIds: string[];
  footerComponentIds: string[];
  autoScroll: boolean;
  showIndicators: boolean;
  headerComponents: number;
  mainSplit: number;
  footerSplit: number;
}

// Mock data generators for different chart types
const mockCharts = {
  bar: () => (
    <div className="w-full h-24 flex items-end justify-center gap-1">
      {[65, 59, 80, 81, 56, 55, 40].map((height, i) => (
        <div
          key={i}
          className="bg-primary/60 w-4 rounded-t-sm"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  ),
  pie: () => (
    <div className="w-24 h-24 rounded-full border-8 border-primary/20 border-l-primary border-t-primary/60 mx-auto" />
  ),
  line: () => (
    <div className="w-full h-24 flex items-center justify-center">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 200 100"
        className="text-primary"
      >
        <path
          d="M 10 90 Q 50 20 100 50 T 190 30"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  ),
  activity: () => (
    <div className="w-full h-24 flex items-end justify-center gap-0.5">
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          className="bg-primary/40 w-2 rounded-t-sm"
          style={{ height: `${Math.random() * 80 + 20}%` }}
        />
      ))}
    </div>
  ),
};

const getRandomMockChart = () => {
  const charts = Object.values(mockCharts);
  return charts[Math.floor(Math.random() * charts.length)]();
};

interface DraggableComponentProps {
  component: {
    id: string;
    name: string;
    fileName: string;
  };
  isInSidebar?: boolean;
  onRemove?: () => void;
  section?: string;
}

function DraggableComponent({
  component,
  isInSidebar = false,
  onRemove,
  section,
}: DraggableComponentProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      setIsDragging(true);
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          componentId: component.id,
          fromSection: section || "sidebar",
          componentName: component.name,
        })
      );
      e.dataTransfer.effectAllowed = "move";
    },
    [component.id, component.name, section]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "relative group cursor-move border rounded-lg p-3 transition-all",
        isDragging ? "opacity-50" : "hover:shadow-md",
        isInSidebar
          ? "bg-card hover:bg-muted/50 border-border"
          : "bg-background border-border shadow-sm"
      )}
    >
      {!isInSidebar && onRemove && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
          onClick={onRemove}
        >
          <Minus className="h-3 w-3" />
        </Button>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {component.name}
          </Badge>
        </div>

        {!isInSidebar && (
          <div className="bg-muted/50 rounded-md p-2">
            {getRandomMockChart()}
          </div>
        )}
      </div>
    </div>
  );
}

interface DropZoneProps {
  section: string;
  title: string;
  components: string[];
  allComponents: {
    [key: string]: { id: string; name: string; fileName: string };
  };
  onDrop: (componentId: string, section: string) => void;
  onRemove: (componentId: string, section: string) => void;
  className?: string;
}

function DropZone({
  section,
  title,
  components,
  allComponents,
  onDrop,
  onRemove,
  className,
}: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (data.componentId && data.fromSection !== section) {
          onDrop(data.componentId, section);
        }
      } catch (error) {
        console.error("Failed to parse drop data:", error);
      }
    },
    [section, onDrop]
  );

  return (
    <div
      className={cn(
        "min-h-32 border-2 border-dashed rounded-lg p-4 transition-all",
        isOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <h3 className="font-medium text-sm text-muted-foreground mb-3">
        {title}
      </h3>

      {components.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
          Drop components here
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 lg:grid-cols-2">
          {components.map((componentId) => {
            const component = allComponents[componentId];
            if (!component) return null;

            return (
              <DraggableComponent
                key={componentId}
                component={component}
                section={section}
                onRemove={() => onRemove(componentId, section)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingsDialog() {
  const { dashboardConfig, updateSettings, saveChanges, isSaving } =
    useDashboard();
  const [localSettings, setLocalSettings] = useState({
    autoScroll: dashboardConfig?.autoScroll ?? true,
    showIndicators: dashboardConfig?.showIndicators ?? true,
    headerComponents: dashboardConfig?.headerComponents ?? 4,
  });

  useEffect(() => {
    if (dashboardConfig) {
      setLocalSettings({
        autoScroll: dashboardConfig.autoScroll,
        showIndicators: dashboardConfig.showIndicators,
        headerComponents: dashboardConfig.headerComponents,
      });
    }
  }, [dashboardConfig]);

  const handleSave = async () => {
    updateSettings(localSettings);
    await saveChanges();
    toast.success("Settings saved successfully");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dashboard Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-scroll">Auto Scroll</Label>
            <Switch
              id="auto-scroll"
              checked={localSettings.autoScroll}
              onCheckedChange={(checked) =>
                setLocalSettings((prev) => ({ ...prev, autoScroll: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="show-indicators">Show Indicators</Label>
            <Switch
              id="show-indicators"
              checked={localSettings.showIndicators}
              onCheckedChange={(checked) =>
                setLocalSettings((prev) => ({
                  ...prev,
                  showIndicators: checked,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="header-components">
              Header Components per Page
            </Label>
            <div className="flex items-center gap-4">
              <Slider
                id="header-components"
                min={1}
                max={8}
                step={1}
                value={[localSettings.headerComponents]}
                onValueChange={([value]) =>
                  setLocalSettings((prev) => ({
                    ...prev,
                    headerComponents: value,
                  }))
                }
                className="flex-1"
              />
              <span className="w-8 text-sm text-muted-foreground">
                {localSettings.headerComponents}
              </span>
            </div>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardEdit() {
  const {
    dashboardConfig,
    availableComponents,
    addComponentToSection,
    removeComponentFromSection,
    moveComponent,
    updateSettings,
    sidebarOpen,
    setSidebarOpen,
  } = useDashboard();

  // Create lookup for all components
  const allComponentsLookup = availableComponents.reduce(
    (acc, comp) => {
      acc[comp.id] = comp;
      return acc;
    },
    {} as { [key: string]: { id: string; name: string; fileName: string } }
  );

  // Add components that are currently in use to the lookup
  if (dashboardConfig) {
    const allUsedComponents = [
      ...dashboardConfig.headerComponentIds,
      ...dashboardConfig.primaryComponentIds,
      ...dashboardConfig.secondaryComponentIds,
      ...dashboardConfig.footerComponentIds,
    ];

    // This would need to be populated from your actual components data
    // For now, creating mock entries for components that are in use but not in availableComponents
    allUsedComponents.forEach((id) => {
      if (!allComponentsLookup[id]) {
        allComponentsLookup[id] = {
          id,
          name: `Component ${id.slice(0, 8)}`,
          fileName: `component-${id}`,
        };
      }
    });
  }

  const handleDrop = useCallback(
    (componentId: string, toSection: string) => {
      // Check if component is coming from sidebar
      const isFromSidebar = availableComponents.some(
        (comp) => comp.id === componentId
      );

      if (isFromSidebar) {
        addComponentToSection(
          componentId,
          toSection as keyof Pick<
            DashboardConfig,
            | "headerComponentIds"
            | "primaryComponentIds"
            | "secondaryComponentIds"
            | "footerComponentIds"
          >
        );
      } else {
        // Find which section it's coming from
        if (!dashboardConfig) return;

        let fromSection = "";
        if (dashboardConfig.headerComponentIds.includes(componentId))
          fromSection = "headerComponentIds";
        else if (dashboardConfig.primaryComponentIds.includes(componentId))
          fromSection = "primaryComponentIds";
        else if (dashboardConfig.secondaryComponentIds.includes(componentId))
          fromSection = "secondaryComponentIds";
        else if (dashboardConfig.footerComponentIds.includes(componentId))
          fromSection = "footerComponentIds";

        if (fromSection && fromSection !== toSection) {
          moveComponent(componentId, fromSection, toSection);
        }
      }
    },
    [availableComponents, dashboardConfig, addComponentToSection, moveComponent]
  );

  const handleRemove = useCallback(
    (componentId: string, section: string) => {
      removeComponentFromSection(
        componentId,
        section as keyof Pick<
          DashboardConfig,
          | "headerComponentIds"
          | "primaryComponentIds"
          | "secondaryComponentIds"
          | "footerComponentIds"
        >
      );
    },
    [removeComponentFromSection]
  );

  const handleResizeEnd = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        const mainSplit = sizes[0] / 100;
        updateSettings({ mainSplit });
      }
    },
    [updateSettings]
  );

  const handleFooterResizeEnd = useCallback(
    (sizes: number[]) => {
      if (sizes.length >= 2) {
        const footerSplit = sizes[0] / (sizes[0] + sizes[1]);
        updateSettings({ footerSplit });
      }
    },
    [updateSettings]
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
      {/* Main Edit Area (2/3) */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={sidebarOpen ? 67 : 100} minSize={50}>
          <div className="h-full p-6 overflow-auto">
            <div className="space-y-6">
              {/* Header Section */}
              <DropZone
                section="headerComponentIds"
                title="Header Metrics"
                components={dashboardConfig.headerComponentIds}
                allComponents={allComponentsLookup}
                onDrop={handleDrop}
                onRemove={handleRemove}
              />

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
                    onLayout={handleResizeEnd}
                    className="min-h-64"
                  >
                    <ResizablePanel
                      defaultSize={dashboardConfig.mainSplit * 100}
                      minSize={30}
                    >
                      <DropZone
                        section="primaryComponentIds"
                        title="Primary Section"
                        components={dashboardConfig.primaryComponentIds}
                        allComponents={allComponentsLookup}
                        onDrop={handleDrop}
                        onRemove={handleRemove}
                        className="h-full mr-3"
                      />
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel
                      defaultSize={(1 - dashboardConfig.mainSplit) * 100}
                      minSize={20}
                    >
                      <DropZone
                        section="secondaryComponentIds"
                        title="Secondary Section"
                        components={dashboardConfig.secondaryComponentIds}
                        allComponents={allComponentsLookup}
                        onDrop={handleDrop}
                        onRemove={handleRemove}
                        className="h-full ml-3"
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </CardContent>
              </Card>

              {/* Footer Section with Resizable Panels */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Footer Content
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResizablePanelGroup
                    direction="horizontal"
                    onLayout={handleFooterResizeEnd}
                    className="min-h-48"
                  >
                    <ResizablePanel
                      defaultSize={dashboardConfig.footerSplit * 100}
                      minSize={30}
                    >
                      <div className="h-full mr-3">
                        <h4 className="font-medium text-sm text-muted-foreground mb-3">
                          Left Footer
                        </h4>
                        <div className="border-2 border-dashed rounded-lg p-4 h-32 border-muted-foreground/25">
                          <div className="text-muted-foreground text-sm">
                            Left section of footer components
                          </div>
                        </div>
                      </div>
                    </ResizablePanel>

                    <ResizableHandle withHandle />

                    <ResizablePanel
                      defaultSize={(1 - dashboardConfig.footerSplit) * 100}
                      minSize={20}
                    >
                      <div className="h-full ml-3">
                        <h4 className="font-medium text-sm text-muted-foreground mb-3">
                          Right Footer
                        </h4>
                        <div className="border-2 border-dashed rounded-lg p-4 h-32 border-muted-foreground/25">
                          <div className="text-muted-foreground text-sm">
                            Right section of footer components
                          </div>
                        </div>
                      </div>
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </CardContent>
              </Card>
            </div>
          </div>
        </ResizablePanel>

        {/* Sidebar (1/3) */}
        {sidebarOpen && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={33} minSize={20} maxSize={50}>
              <div className="h-full border-l bg-muted/30">
                <div className="p-4 border-b bg-background">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">Components</h2>
                    <div className="flex items-center gap-2">
                      <SettingsDialog />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSidebarOpen(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="p-4 h-full overflow-auto">
                  <div className="space-y-3">
                    {availableComponents.map((component) => (
                      <DraggableComponent
                        key={component.id}
                        component={component}
                        isInSidebar
                      />
                    ))}

                    {availableComponents.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-8">
                        No available components
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Sidebar Toggle Button */}
      {!sidebarOpen && (
        <Button
          size="sm"
          variant="outline"
          className="fixed top-4 right-4 z-50"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelRightClose className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
