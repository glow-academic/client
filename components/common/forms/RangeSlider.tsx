/**
 * RangeSlider.tsx
 * Range slider component for selecting min/max values
 * Similar to ParameterSelector slider with labels below handles
 * @AshokSaravanan222
 * 01/20/2025
 */

"use client";

import { useEffect, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

export interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function RangeSlider({
  min,
  max,
  value,
  onValueChange,
  disabled = false,
  label,
  className,
}: RangeSliderProps) {
  const [minValue, maxValue] = value;
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const [handlePositions, setHandlePositions] = useState<
    Record<number, number>
  >({});

  useEffect(() => {
    const updateHandlePositions = () => {
      if (containerRef.current && sliderRef.current) {
        const handles = sliderRef.current.querySelectorAll(
          '[data-slot="slider-thumb"]',
        ) as NodeListOf<HTMLElement>;
        const containerRect = containerRef.current.getBoundingClientRect();
        const positions: Record<number, number> = {};

        handles.forEach((handle, index) => {
          const handleRect = handle.getBoundingClientRect();
          const handleCenter = handleRect.left + handleRect.width / 2;
          const positionInContainer = handleCenter - containerRect.left;
          const containerWidth = containerRef.current!.offsetWidth;
          if (containerWidth > 0) {
            const handleValue = value[index];
            if (handleValue !== undefined) {
              positions[handleValue] =
                (positionInContainer / containerWidth) * 100;
            }
          }
        });

        setHandlePositions(positions);
      }
    };

    // Use requestAnimationFrame to ensure DOM is ready
    const rafId = requestAnimationFrame(() => {
      updateHandlePositions();
    });

    window.addEventListener("resize", updateHandlePositions);
    // Use MutationObserver to watch for slider changes
    const observer = new MutationObserver(() => {
      requestAnimationFrame(updateHandlePositions);
    });
    if (sliderRef.current) {
      observer.observe(sliderRef.current, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updateHandlePositions);
      observer.disconnect();
    };
  }, [value, min, max]);

  const getLabelPosition = (val: number): number => {
    // Use measured handle position if available, otherwise fallback to calculation
    if (handlePositions[val] !== undefined) {
      return handlePositions[val];
    }
    // Fallback to percentage calculation
    return ((val - min) / (max - min)) * 100;
  };

  const handleSliderChange = (values: number[]) => {
    if (
      values.length >= 2 &&
      values[0] !== undefined &&
      values[1] !== undefined
    ) {
      // Ensure values are within bounds and min <= max
      const newMin = Math.max(min, Math.min(max, values[0]));
      const newMax = Math.max(min, Math.min(max, values[1]));
      onValueChange([newMin, Math.max(newMin, newMax)]);
    }
  };

  return (
    <div className={className || "space-y-2"}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div
        className="relative"
        style={{ paddingBottom: "8px" }}
        ref={containerRef}
      >
        <div ref={sliderRef}>
          <Slider
            value={[minValue, maxValue]}
            min={min}
            max={max}
            step={1}
            onValueChange={handleSliderChange}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Combined labels container - all at bottom-0 for perfect alignment */}
        <div className="absolute bottom-0 inset-x-0">
          {/* Min edge label - always shown */}
          <span className="absolute left-0 text-xs text-muted-foreground leading-none">
            {min}
          </span>

          {/* Max edge label - always shown */}
          <span className="absolute right-0 text-xs text-muted-foreground leading-none">
            {max}
          </span>

          {/* Handle value labels - show below each handle */}
          {/* When minValue === maxValue, show only one label to avoid duplication */}
          {minValue === maxValue ? (
            // Single value case: show label only if it's not at the edges
            minValue !== min &&
            minValue !== max && (
              <span
                className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                style={{
                  left: `${getLabelPosition(minValue)}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {minValue}
              </span>
            )
          ) : (
            // Range case: show both labels if they're not at the edges
            <>
              {minValue !== min && (
                <span
                  className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                  style={{
                    left: `${getLabelPosition(minValue)}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {minValue}
                </span>
              )}
              {maxValue !== max && (
                <span
                  className="absolute text-xs font-medium text-muted-foreground leading-none whitespace-nowrap"
                  style={{
                    left: `${getLabelPosition(maxValue)}%`,
                    transform: "translateX(-50%)",
                  }}
                >
                  {maxValue}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
