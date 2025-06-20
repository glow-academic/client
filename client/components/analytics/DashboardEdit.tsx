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
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import registry from "@/components/common/analytics/Registry";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboard } from "@/contexts/dashboard-context";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/types";
import { logError } from "@/utils/logger";
import { updateComponent } from "@/utils/mutations/components/update-component";
import { createDashboard } from "@/utils/mutations/dashboards/create-dashboard";
import { updateDashboard } from "@/utils/mutations/dashboards/update-dashboard";
import { getAllComponents } from "@/utils/queries/components/get-all-components";
import { getAllDashboards } from "@/utils/queries/dashboards/get-all-dashboards";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { DialogDescription } from "@radix-ui/react-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Settings,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface DashboardComponent {
  id: string;
  name: string;
  fileName: string;
  layout: Record<string, unknown>;
  stat?: boolean;
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
  stat: (componentId: string, componentName?: string) => {
    // Generate a consistent number based on component ID
    const hash = componentId.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);
    const number = (Math.abs(hash) % 1000) + 100; // Number between 100-1099
    const formatted = number.toLocaleString();

    // Generate realistic stat names based on component name
    const getStatLabel = (name: string) => {
      const nameLower = name.toLowerCase();
      if (nameLower.includes("session")) return "Total Sessions";
      if (nameLower.includes("score") || nameLower.includes("average"))
        return "Avg Score";
      if (nameLower.includes("completion")) return "Completion %";
      if (nameLower.includes("pass")) return "Pass Rate %";
      if (nameLower.includes("active")) return "Active Count";
      if (nameLower.includes("total")) return "Total Count";
      if (nameLower.includes("training") && nameLower.includes("hour"))
        return "Training Hrs";
      if (nameLower.includes("support") || nameLower.includes("need"))
        return "Need Support";
      if (nameLower.includes("ta")) return "Active TAs";
      // Default fallback
      return `${name} Metric`;
    };

    return (
      <div className="w-full h-24 flex flex-col items-center justify-center">
        <div className="text-2xl font-bold text-primary">{formatted}</div>
        <div className="text-xs text-muted-foreground mt-1 text-center">
          {getStatLabel(componentName || "Stat")}
        </div>
      </div>
    );
  },
};

// Assign consistent chart types to components
const getConsistentMockChart = (
  componentId: string,
  component?: { stat?: boolean; name?: string }
) => {
  // Check if component has stat property
  const isStat = component?.stat === true;

  if (isStat) {
    return (
      mockCharts.stat as (id: string, name?: string) => React.JSX.Element
    )(componentId, component?.name);
  }

  const chartTypes = ["bar", "pie", "line", "activity"] as const;
  const hash = componentId.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);
  const chartType = chartTypes[Math.abs(hash) % chartTypes.length]!;
  return mockCharts[chartType]();
};

interface DraggableComponentProps {
  component: {
    id: string;
    name: string;
    fileName: string;
    stat?: boolean;
    layout?: Record<string, unknown>;
  };
  isInSidebar?: boolean;
  onRemove?: () => void;
  section?: string;
  index?: number;
  onReorder?: (dragIndex: number, hoverIndex: number) => void;
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
}

function DraggableComponent({
  component,
  isInSidebar = false,
  onRemove,
  section,
  index,
  onReorder,
  onUpdateLayout,
}: DraggableComponentProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [layoutForm, setLayoutForm] = useState<Record<string, unknown>>(
    component.layout || {}
  );

  // Check if component has props in registry
  const registryEntry = registry[component.id];
  const hasProps =
    registryEntry?.props && Object.keys(registryEntry.props).length > 0;

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      setIsDragging(true);
      e.dataTransfer.setData(
        "text/plain",
        JSON.stringify({
          componentId: component.id,
          fromSection: section || "sidebar",
          componentName: component.name,
          fromIndex: index,
        })
      );
      e.dataTransfer.effectAllowed = "move";
    },
    [component.id, component.name, section, index]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (!onReorder || index === undefined) return;

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));
        if (
          data.componentId !== component.id &&
          data.fromSection === section &&
          data.fromIndex !== undefined
        ) {
          onReorder(data.fromIndex, index);
        }
      } catch (error) {
        logError("Failed to parse drop data:", error);
      }
    },
    [component.id, section, index, onReorder]
  );

  const handleSaveLayout = useCallback(() => {
    if (onUpdateLayout) {
      onUpdateLayout(component.id, layoutForm);
      setIsEditDialogOpen(false);
      toast.success("Component layout updated");
    }
  }, [component.id, layoutForm, onUpdateLayout]);

  const renderFormField = (key: string, value: unknown) => {
    if (typeof value === "string") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{key}</Label>
          <Input
            id={key}
            value={(layoutForm[key] as string) || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLayoutForm((prev) => ({ ...prev, [key]: e.target.value }))
            }
            placeholder={`Enter ${key}`}
          />
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <div key={key} className="flex items-center space-x-2">
          <Switch
            id={key}
            checked={(layoutForm[key] as boolean) || false}
            onCheckedChange={(checked) =>
              setLayoutForm((prev) => ({ ...prev, [key]: checked }))
            }
          />
          <Label htmlFor={key}>{key}</Label>
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{key}</Label>
          <Input
            id={key}
            type="number"
            value={(layoutForm[key] as number) || 0}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLayoutForm((prev) => ({
                ...prev,
                [key]: Number(e.target.value),
              }))
            }
            placeholder={`Enter ${key}`}
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={dragRef}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={!isInSidebar ? handleDragOver : undefined}
      onDragLeave={!isInSidebar ? handleDragLeave : undefined}
      onDrop={!isInSidebar ? handleDrop : undefined}
      className={cn(
        "relative group cursor-move border rounded-lg p-3 transition-all min-w-0 overflow-hidden",
        isDragging ? "opacity-50" : "hover:shadow-md",
        dragOver && !isInSidebar ? "border-primary bg-primary/5" : "",
        isInSidebar
          ? "bg-card hover:bg-muted/50 border-border"
          : "bg-background border-border shadow-sm"
      )}
    >
      {!isInSidebar && onRemove && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full z-10"
          onClick={onRemove}
        >
          <Minus className="h-3 w-3" />
        </Button>
      )}

      <div className="space-y-2 min-w-0 flex flex-col justify-between">
        <div className="flex items-center gap-2 min-w-0 justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-xs truncate max-w-full">
              {component.name}
            </Badge>
            {isInSidebar && (
              <Badge
                variant={component.stat ? "default" : "secondary"}
                className="text-xs"
              >
                {component.stat ? "Stat" : "Graph"}
              </Badge>
            )}
          </div>
          
          {isInSidebar && hasProps && (
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="h-6 w-6 p-0 text-white rounded-full"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setLayoutForm(
                          component.layout || registryEntry?.props || {}
                        );
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit</p>
                </TooltipContent>
              </Tooltip>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit {component.name}</DialogTitle>
                  <DialogDescription>
                    Configure the properties for this component.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {registryEntry?.props &&
                    Object.entries(registryEntry.props).map(([key, value]) =>
                      renderFormField(key, value)
                    )}
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button onClick={handleSaveLayout}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {!isInSidebar && (
          <div className="bg-muted/50 rounded-md p-2">
            {getConsistentMockChart(component.id, component)}
          </div>
        )}
      </div>
    </div>
  );
}

interface HeaderPreviewProps {
  components: string[];
  allComponents: {
    [key: string]: {
      id: string;
      name: string;
      fileName: string;
      stat?: boolean;
    };
  };
  headerComponents: number;
  showIndicators: boolean;
  autoScroll: boolean;
  onRemove: (componentId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function HeaderPreview({
  components,
  allComponents,
  headerComponents,
  showIndicators,
  autoScroll,
  onRemove,
  onReorder,
}: HeaderPreviewProps) {
  const [currentPage, setCurrentPage] = useState(0);

  // Create pages based on headerComponents setting
  const pages = useMemo(() => {
    const result = [];
    const totalPages = Math.ceil(components.length / headerComponents);

    for (let i = 0; i < totalPages; i++) {
      const start = i * headerComponents;
      const end = start + headerComponents;
      result.push(components.slice(start, end));
    }

    return result;
  }, [components, headerComponents]);

  // Auto-scroll effect
  useEffect(() => {
    if (!autoScroll || pages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % pages.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoScroll, pages.length]);

  const currentPageComponents = pages[currentPage] || [];
  const pageStartIndex = currentPage * headerComponents;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden">
        <div
          className="grid gap-4 min-w-0"
          style={{
            gridTemplateColumns: `repeat(${headerComponents}, minmax(0, 1fr))`,
          }}
        >
          {currentPageComponents.map((componentId, index) => {
            const component = allComponents[componentId];
            if (!component) return null;

            const actualIndex = pageStartIndex + index;

            return (
              <div
                key={`${componentId}-${currentPage}-${index}`}
                className="transition-all duration-500 ease-in-out min-w-0"
              >
                <DraggableComponent
                  component={component}
                  section="headerComponentIds"
                  index={actualIndex}
                  onRemove={() => onRemove(componentId)}
                  onReorder={onReorder}
                />
              </div>
            );
          })}

          {/* Fill remaining slots with empty divs for consistent spacing */}
          {Array.from({
            length: Math.max(
              0,
              headerComponents - currentPageComponents.length
            ),
          }).map((_, index) => (
            <div key={`empty-${index}`} className="invisible min-w-0" />
          ))}
        </div>
      </div>

      {/* Carousel indicators */}
      {showIndicators && pages.length > 1 && (
        <div className="flex justify-center gap-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentPage ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FooterPreviewProps {
  components: string[];
  allComponents: {
    [key: string]: {
      id: string;
      name: string;
      fileName: string;
      stat?: boolean;
    };
  };
  showIndicators: boolean;
  autoScroll: boolean;
  footerSplit: number;
  onRemove: (componentId: string) => void;
  onResizeEnd: (sizes: number[]) => void;
}

function FooterPreview({
  components,
  allComponents,
  showIndicators,
  autoScroll,
  footerSplit,
  onRemove,
  onResizeEnd,
}: FooterPreviewProps) {
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(0);

  // Split components for left/right sections (interleaved)
  const leftComponents = components.filter((_, index) => index % 2 === 0);
  const rightComponents = components.filter((_, index) => index % 2 === 1);

  // Auto-scroll effects
  useEffect(() => {
    if (!autoScroll || leftComponents.length <= 1) return;

    const interval = setInterval(() => {
      setLeftIndex((prev) => (prev + 1) % leftComponents.length);
    }, 6000);

    return () => clearInterval(interval);
  }, [autoScroll, leftComponents.length]);

  useEffect(() => {
    if (!autoScroll || rightComponents.length <= 1) return;

    const interval = setInterval(() => {
      setRightIndex((prev) => (prev + 1) % rightComponents.length);
    }, 7000);

    return () => clearInterval(interval);
  }, [autoScroll, rightComponents.length]);

  if (components.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
        Drop components here
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={onResizeEnd}
        className="min-h-64"
      >
        {/* Left Footer Section */}
        <ResizablePanel defaultSize={footerSplit * 100} minSize={30}>
          <div className="h-full mr-3">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">
              Left Footer
            </h4>
            {leftComponents.length > 0 ? (
              <div className="space-y-4">
                <DraggableComponent
                  key={`left-${leftComponents[leftIndex % leftComponents.length]}-${leftIndex}`}
                  component={
                    allComponents[
                      leftComponents[leftIndex % leftComponents.length]!
                    ]!
                  }
                  section="footerComponentIds"
                  onRemove={() =>
                    onRemove(leftComponents[leftIndex % leftComponents.length]!)
                  }
                />

                {/* Left indicators */}
                {showIndicators && leftComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {leftComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setLeftIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === leftIndex % leftComponents.length
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                Drop components here
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Footer Section */}
        <ResizablePanel defaultSize={(1 - footerSplit) * 100} minSize={20}>
          <div className="h-full ml-3">
            <h4 className="font-medium text-sm text-muted-foreground mb-3">
              Right Footer
            </h4>
            {rightComponents.length > 0 ? (
              <div className="space-y-4">
                <DraggableComponent
                  key={`right-${rightComponents[rightIndex % rightComponents.length]}-${rightIndex}`}
                  component={
                    allComponents[
                      rightComponents[rightIndex % rightComponents.length]!
                    ]!
                  }
                  section="footerComponentIds"
                  onRemove={() =>
                    onRemove(
                      rightComponents[rightIndex % rightComponents.length]!
                    )
                  }
                />

                {/* Right indicators */}
                {showIndicators && rightComponents.length > 1 && (
                  <div className="flex justify-center gap-2">
                    {rightComponents.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setRightIndex(index)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          index === rightIndex % rightComponents.length
                            ? "bg-primary"
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                Drop components here
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

interface CarouselSectionProps {
  components: string[];
  allComponents: {
    [key: string]: {
      id: string;
      name: string;
      fileName: string;
      stat?: boolean;
    };
  };
  showIndicators: boolean;
  autoScroll: boolean;
  onRemove: (componentId: string) => void;
  interval?: number;
}

function CarouselSection({
  components,
  allComponents,
  showIndicators,
  autoScroll,
  onRemove,
  interval = 5000,
}: CarouselSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!autoScroll || components.length <= 1) return;

    const intervalId = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % components.length);
    }, interval);

    return () => clearInterval(intervalId);
  }, [autoScroll, components.length, interval]);

  if (components.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
        Drop components here
      </div>
    );
  }

  const currentComponentId =
    components.length > 0 ? components[currentIndex % components.length] : null;
  const currentComponent = currentComponentId
    ? allComponents[currentComponentId]
    : undefined;

  return (
    <div className="space-y-4">
      {currentComponent && (
        <DraggableComponent
          key={`${currentComponent.id}-${currentIndex}`}
          component={currentComponent}
          onRemove={() => onRemove(currentComponent.id)}
        />
      )}

      {/* Carousel indicators */}
      {showIndicators && components.length > 1 && (
        <div className="flex justify-center gap-2">
          {components.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex % components.length
                  ? "bg-primary"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DropZoneProps {
  section: string;
  title: string;
  components: string[];
  allComponents: {
    [key: string]: {
      id: string;
      name: string;
      fileName: string;
      stat?: boolean;
    };
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
        logError("Failed to parse drop data:", error);
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

function SettingsDialog({
  dashboardConfig,
  updateSettings,
}: {
  dashboardConfig: Partial<Dashboard> | null;
  updateSettings: (
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
  ) => void;
}) {
  const [localSettings, setLocalSettings] = useState({
    autoScroll: dashboardConfig?.autoScroll ?? true,
    showIndicators: dashboardConfig?.showIndicators ?? true,
    headerComponents: dashboardConfig?.headerComponents ?? 4,
  });

  useEffect(() => {
    if (dashboardConfig) {
      setLocalSettings({
        autoScroll: dashboardConfig.autoScroll ?? false,
        showIndicators: dashboardConfig.showIndicators ?? false,
        headerComponents: dashboardConfig.headerComponents ?? 4,
      });
    }
  }, [dashboardConfig]);

  const handleApply = () => {
    updateSettings(localSettings);
    toast.success("Settings applied");
  };

  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p> Settings</p>
        </TooltipContent>
      </Tooltip>
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
                    headerComponents: value ?? 1,
                  }))
                }
                className="flex-1"
              />
              <span className="w-8 text-sm text-muted-foreground">
                {localSettings.headerComponents}
              </span>
            </div>
          </div>

          <Button onClick={handleApply} className="w-full">
            Apply Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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
