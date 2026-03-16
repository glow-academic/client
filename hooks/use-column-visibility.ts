"use client";

import { useState, useCallback } from "react";
import type { VisibilityState } from "@tanstack/react-table";

const COOKIE_PREFIX = "glow_view_";
const COOKIE_MAX_AGE = 31536000; // 1 year

function writeCookie(key: string, state: VisibilityState) {
  const value = encodeURIComponent(JSON.stringify(state));
  document.cookie = `${COOKIE_PREFIX}${key}=${value}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Drop-in replacement for `useState<VisibilityState>({})` that persists
 * column visibility to a cookie named `glow_view_{key}`.
 *
 * The initial state is read SSR-side in the page's server component and
 * passed down as `initialState` — no client-side cookie parsing needed.
 *
 * Usage:
 *   // page.tsx (RSC): read cookie, pass as prop
 *   // Component.tsx: const [columnVisibility, setColumnVisibility] = useColumnVisibility("personas", initialColumnVisibility);
 */
export function useColumnVisibility(
  key: string,
  initialState: VisibilityState = {},
): [VisibilityState, (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => void] {
  const [state, _setState] = useState<VisibilityState>(initialState);

  const setState = useCallback(
    (updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
      _setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        writeCookie(key, next);
        return next;
      });
    },
    [key],
  );

  return [state, setState];
}
