/**
 * ThemePreview.tsx
 * Mini UI mockup preview showing all configured theme colors
 * Visual-only component (no text labels)
 */
"use client";

import React from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ThemePreviewProps {
  primary_color: string;
  accent: string;
  background: string;
  surface: string;
  success: string;
  warning: string;
  error: string;
  sidebar_background: string;
  sidebar_primary: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
  onResetAll?: () => void;
  hasChanges?: boolean;
  themePicker?: React.ReactNode;
  stepStatus?: "pending" | "active" | "completed";
  onScrollToTop?: () => void;
  onScrollToBottom?: () => void;
  onAccordionOpen?: (accordionValue: string) => void;
  scrollRefs?: {
    primaryColorRef?: React.RefObject<HTMLDivElement | null>;
    accentRef?: React.RefObject<HTMLDivElement | null>;
    backgroundRef?: React.RefObject<HTMLDivElement | null>;
    surfaceRef?: React.RefObject<HTMLDivElement | null>;
    successRef?: React.RefObject<HTMLDivElement | null>;
    warningRef?: React.RefObject<HTMLDivElement | null>;
    errorRef?: React.RefObject<HTMLDivElement | null>;
    sidebarBackgroundRef?: React.RefObject<HTMLDivElement | null>;
    sidebarPrimaryRef?: React.RefObject<HTMLDivElement | null>;
    chart1Ref?: React.RefObject<HTMLDivElement | null>;
    chart2Ref?: React.RefObject<HTMLDivElement | null>;
    chart3Ref?: React.RefObject<HTMLDivElement | null>;
    chart4Ref?: React.RefObject<HTMLDivElement | null>;
    chart5Ref?: React.RefObject<HTMLDivElement | null>;
  };
}

/**
 * Helper function to determine if a color is light or dark
 * Returns true if the color is light (should use dark text)
 */
function isLightColor(hex: string): boolean {
  // Remove # if present
  const color = hex.replace("#", "");

  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5;
}

export function ThemePreview({
  primary_color,
  accent,
  background,
  surface,
  success,
  warning,
  error,
  sidebar_background,
  sidebar_primary,
  chart1,
  chart2,
  chart3,
  chart4,
  chart5,
  onResetAll,
  hasChanges = false,
  themePicker,
  stepStatus = "active",
  onScrollToTop,
  onScrollToBottom,
  onAccordionOpen,
  scrollRefs,
}: ThemePreviewProps) {
  const primaryIsLight = isLightColor(primary_color);

  const handleScrollTo = (
    ref?: React.RefObject<HTMLDivElement>,
    accordionValue?: string,
  ) => {
    if (ref?.current) {
      // Open accordion FIRST, then scroll after layout adjusts
      if (accordionValue && onAccordionOpen) {
        onAccordionOpen(accordionValue);
        // Wait for accordion animation to complete (typically 200-300ms), then scroll
        // Using a longer timeout ensures the accordion is fully expanded before scrolling
        setTimeout(() => {
          if (ref?.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 175); // Wait for accordion animation to complete
      } else {
        // No accordion to open, scroll immediately
        ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleScrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleScrollToBottom = () => {
    if (onScrollToBottom) {
      onScrollToBottom();
    } else {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
              stepStatus === "completed"
                ? ""
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
            style={
              stepStatus === "completed"
                ? {
                    backgroundColor: primary_color,
                    color: isLightColor(primary_color) ? "#000000" : "#ffffff",
                  }
                : undefined
            }
          >
            {stepStatus === "completed" ? <Check className="w-4 h-4" /> : "0"}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">Preview</CardTitle>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {themePicker}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleScrollToTop}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Scroll to top</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleScrollToBottom}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Scroll to bottom</p>
              </TooltipContent>
            </Tooltip>
            {onResetAll && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onResetAll}
                    disabled={!hasChanges}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Reset all</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        {/* Mini UI Mockup Container */}
        <div
          className="relative rounded-lg border-2 border-border overflow-hidden shadow-lg cursor-pointer"
          style={{ backgroundColor: background }}
        >
          <div className="flex h-48">
            {/* Sidebar */}
            <div
              className="w-12 shrink-0 border-r border-border/50 cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: sidebar_background }}
              onClick={() =>
                handleScrollTo(
                  scrollRefs?.sidebarBackgroundRef,
                  "sidebar-background",
                )
              }
            >
              {/* Sidebar accent elements */}
              <div className="p-2 space-y-2">
                <div
                  className="w-full h-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: sidebar_primary }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScrollTo(
                      scrollRefs?.sidebarPrimaryRef,
                      "sidebar-primary",
                    );
                  }}
                />
                <div
                  className="w-3/4 h-1.5 rounded opacity-60"
                  style={{ backgroundColor: sidebar_primary }}
                />
                <div
                  className="w-2/3 h-1.5 rounded opacity-40"
                  style={{ backgroundColor: sidebar_primary }}
                />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-4 space-y-3">
              {/* Surface Card */}
              <div
                className="rounded-lg p-3 border border-border/30 shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: surface }}
                onClick={() =>
                  handleScrollTo(scrollRefs?.surfaceRef, "surface")
                }
              >
                {/* Primary Button */}
                <div className="mb-2">
                  <div
                    className="inline-block px-3 py-1.5 rounded-md text-xs font-medium min-w-[60px] cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      backgroundColor: primary_color,
                      color: primaryIsLight ? "#000000" : "#ffffff",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollTo(
                        scrollRefs?.primaryColorRef,
                        "primary-color",
                      );
                    }}
                  >
                    {/* Visual button representation */}
                  </div>
                </div>

                {/* Accent Element - More Prominent */}
                <div
                  className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleScrollTo(scrollRefs?.accentRef, "accent");
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: accent }}
                  />
                  <div
                    className="flex-1 h-2 rounded"
                    style={{ backgroundColor: accent, opacity: 0.5 }}
                  />
                </div>

                {/* Status Indicators */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: success }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollTo(scrollRefs?.successRef, "success");
                    }}
                  />
                  <div
                    className="w-2 h-2 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: warning }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollTo(scrollRefs?.warningRef, "warning");
                    }}
                  />
                  <div
                    className="w-2 h-2 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: error }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScrollTo(scrollRefs?.errorRef, "error");
                    }}
                  />
                </div>
              </div>

              {/* Chart Colors Row */}
              <div className="flex items-center gap-1.5">
                {[
                  {
                    color: chart1,
                    ref: scrollRefs?.chart1Ref,
                    accordion: "chart1",
                  },
                  {
                    color: chart2,
                    ref: scrollRefs?.chart2Ref,
                    accordion: "chart2",
                  },
                  {
                    color: chart3,
                    ref: scrollRefs?.chart3Ref,
                    accordion: "chart3",
                  },
                  {
                    color: chart4,
                    ref: scrollRefs?.chart4Ref,
                    accordion: "chart4",
                  },
                  {
                    color: chart5,
                    ref: scrollRefs?.chart5Ref,
                    accordion: "chart5",
                  },
                ].map((item, index) => (
                  <div
                    key={index}
                    className="flex-1 h-8 rounded border border-border/30 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: item.color }}
                    onClick={() => handleScrollTo(item.ref, item.accordion)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
