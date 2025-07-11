/**
 * CarouselSection.tsx
 * This component is used to display the carousel section for the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import { useEffect, useState } from "react";
import DraggableComponent from "./DraggableComponent";

export interface CarouselSectionProps {
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
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
  interval?: number;
}

export default function CarouselSection({
  components,
  allComponents,
  showIndicators,
  autoScroll,
  onRemove,
  onUpdateLayout,
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
          {...(onUpdateLayout && { onUpdateLayout })}
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
