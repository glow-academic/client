/**
 * DropZone.tsx
 * This component is used to display the drop zone for the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import { cn } from "@/lib/utils";
import { logError } from "@/utils/logger";
import { useCallback, useState } from "react";
import DraggableComponent from "./DraggableComponent";

export interface DropZoneProps {
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
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
  className?: string;
}

export default function DropZone({
  section,
  title,
  components,
  allComponents,
  onDrop,
  onRemove,
  onUpdateLayout,
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
                {...(onUpdateLayout && { onUpdateLayout })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
