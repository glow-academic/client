"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MIN_SPIN_MS = 600;
const SETTLE_DELAY_MS = 150;
const FALLBACK_STOP_MS = 1200;

export interface RefreshButtonProps {
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tooltip?: string;
  ariaLabel?: string;
}

/**
 * Canonical refresh button: 32×32 icon-only with tooltip, plus a
 * flicker-resistant spinner. Spin keeps running for a minimum duration
 * and only stops at the next rotation boundary, so fast refreshes don't
 * produce a one-frame blink and the icon never freezes mid-spin.
 */
export function RefreshButton({
  onClick,
  disabled = false,
  tooltip = "Refresh",
  ariaLabel = "Refresh",
}: RefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [requestStop, setRequestStop] = useState(false);
  const spinStartRef = useRef<number | null>(null);
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = async () => {
    if (!spinning) {
      setSpinning(true);
      spinStartRef.current = performance.now();
    }
    setIsRefreshing(true);
    try {
      await onClick();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isRefreshing) {
      if (!spinning) {
        setSpinning(true);
        spinStartRef.current = performance.now();
      }
      return undefined;
    }
    if (!spinning) return undefined;

    const startedAt = spinStartRef.current ?? performance.now();
    const elapsed = performance.now() - startedAt;
    const waitMs = Math.max(0, MIN_SPIN_MS - elapsed) + SETTLE_DELAY_MS;

    const t = setTimeout(() => {
      // Defer the actual stop to the next animation-iteration so the
      // icon lands on a clean rotation boundary. If no iteration fires
      // (tab hidden, reduced-motion, etc.), the fallback stops it.
      setRequestStop(true);
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
      fallbackRef.current = setTimeout(() => {
        setSpinning(false);
        setRequestStop(false);
        spinStartRef.current = null;
        fallbackRef.current = null;
      }, FALLBACK_STOP_MS);
    }, waitMs);

    return () => clearTimeout(t);
  }, [isRefreshing, spinning]);

  useEffect(
    () => () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current);
    },
    [],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleClick}
            disabled={disabled || isRefreshing}
            aria-label={ariaLabel}
          >
            <RefreshCw
              aria-hidden
              onAnimationIteration={() => {
                if (!requestStop) return;
                if (fallbackRef.current) {
                  clearTimeout(fallbackRef.current);
                  fallbackRef.current = null;
                }
                setSpinning(false);
                setRequestStop(false);
                spinStartRef.current = null;
              }}
              className={`h-4 w-4 will-change-transform ${
                spinning ? "animate-spin" : ""
              }`}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
