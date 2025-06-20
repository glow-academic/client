/**
 * FooterPreview.tsx
 * This component is used to display the footer preview for the dashboard.
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useEffect, useState } from "react";
import DraggableComponent from "./DraggableComponent";

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
  onUpdateLayout?: (
    componentId: string,
    layout: Record<string, unknown>
  ) => void;
  onResizeEnd: (sizes: number[]) => void;
}

export default function FooterPreview({
  components,
  allComponents,
  showIndicators,
  autoScroll,
  footerSplit,
  onRemove,
  onUpdateLayout,
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
                  {...(onUpdateLayout && { onUpdateLayout })}
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
                  {...(onUpdateLayout && { onUpdateLayout })}
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
