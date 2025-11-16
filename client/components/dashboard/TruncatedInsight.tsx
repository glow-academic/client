"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";

export function TruncatedInsight({ text }: { text: string }) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const checkTruncation = () => {
      if (textRef.current) {
        // For line-clamp-2, check if scrollHeight exceeds 2 lines
        // Approximate 2 lines: line-height (1.25rem for text-sm) * 2 = ~2.5rem = 40px
        // Add some tolerance for padding/margins
        const lineHeight = 20; // ~1.25rem for text-sm
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
  }, [text]);

  const content = (
    <div className="p-3 bg-muted rounded-lg">
      <p ref={textRef} className="text-sm text-muted-foreground line-clamp-2">
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
        <TooltipContent className="max-w-md">
          <p className="text-sm">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

