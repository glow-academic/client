"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function TruncatedInsight({
  text,
  isMobile = false,
}: {
  text: string;
  isMobile?: boolean;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        // For line-clamp-2, check if scrollHeight exceeds 2 lines
        // Approximate 2 lines: line-height (1.25rem for text-sm) * 2 = ~2.5rem = 40px
        // For mobile, use smaller line height
        const lineHeight = isMobile ? 16 : 20; // ~1rem for text-xs, ~1.25rem for text-sm
        const maxHeight = lineHeight * 2;
        const isOverflowing =
          textRef.current.scrollHeight > maxHeight ||
          textRef.current.scrollWidth > textRef.current.clientWidth;
        setIsTruncated(isOverflowing);
      }
    };

    // Use setTimeout to ensure DOM is fully rendered
    const timeoutId = setTimeout(() => {
      checkTruncation();
    }, 0);

    // Recheck on window resize
    window.addEventListener("resize", checkTruncation);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkTruncation);
    };
  }, [text, isMobile]);

  const content = (
    <div className={cn("bg-muted rounded-lg", isMobile ? "p-2" : "p-3")}>
      <p
        ref={textRef}
        className={cn(
          "text-muted-foreground line-clamp-2",
          isMobile ? "text-xs" : "text-sm"
        )}
      >
        {text}
      </p>
    </div>
  );

  if (!isTruncated) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent
          className={cn(isMobile ? "max-w-[calc(100vw-2rem)]" : "max-w-md")}
        >
          <p className={cn(isMobile ? "text-xs" : "text-sm")}>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
