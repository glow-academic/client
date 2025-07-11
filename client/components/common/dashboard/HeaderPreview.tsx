/**
 * HeaderPreview.tsx
 * This component is used to display the header preview for the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import { useEffect, useMemo, useState } from "react";
import DraggableComponent from "./DraggableComponent";

export interface HeaderPreviewProps {
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
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export default function HeaderPreview({
  components,
  allComponents,
  headerComponents,
  showIndicators,
  autoScroll,
  onRemove,
  onUpdateLayout,
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
                  {...(onUpdateLayout && { onUpdateLayout })}
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
