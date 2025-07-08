/**
 * DraggableComponent.tsx
 * This component is used to display a component in the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import registry from "@/components/common/analytics/Registry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { logError } from "@/utils/logger";
import { Edit, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

// Utility function to convert camelCase to Title Case
const camelToTitleCase = (str: string): string => {
  return str
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
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
  isManagementView?: boolean;
  hideRemoveButton?: boolean;
  onRemove?: () => void;
  section?: string;
  index?: number;
  onReorder?: (dragIndex: number, hoverIndex: number) => void;
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
}

export default function DraggableComponent({
  component,
  isInSidebar = false,
  isManagementView = false,
  hideRemoveButton = false,
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
          <Label htmlFor={key}>{camelToTitleCase(key)}</Label>
          <Input
            id={key}
            value={(layoutForm[key] as string) || ""}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setLayoutForm((prev) => ({ ...prev, [key]: e.target.value }))
            }
            placeholder={`Enter ${camelToTitleCase(key).toLowerCase()}`}
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
          <Label htmlFor={key}>{camelToTitleCase(key)}</Label>
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={key}>{camelToTitleCase(key)}</Label>
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
            placeholder={`Enter ${camelToTitleCase(key).toLowerCase()}`}
          />
        </div>
      );
    }

    return null;
  };

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
      {/* Remove button - improved positioning with close icon */}
      {!(isInSidebar && !isManagementView) && !hideRemoveButton && onRemove && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className={cn(
                "absolute h-6 w-6 p-0 transition-opacity bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full z-10",
                isManagementView 
                  ? "top-2.5 right-2.5 opacity-100" 
                  : "top-1 right-1 opacity-0 group-hover:opacity-100"
              )}
              onClick={onRemove}
            >
              <X className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Remove</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Edit button for components with props */}
      {hasProps && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "absolute h-6 w-6 p-0 transition-opacity bg-blue-500/10 text-blue-600 hover:bg-blue-500 hover:text-white rounded-full z-10",
                    isManagementView
                      ? "top-2.5 right-10.5 opacity-100" // extra spacing for remove button in management view
                      : isInSidebar
                        ? "top-2.5 right-2.5 opacity-100"
                        : "top-1 right-8 opacity-0 group-hover:opacity-100"
                  )}
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
