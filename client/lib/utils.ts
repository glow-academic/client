import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the correct WebSocket endpoint for the current runtime.
 *
 * • In the browser  → wss://<site>/api/ws
 * • In SSR / Node  → ws://fastapi:8000   (Docker-internal DNS)
 */
export function getWebSocketUrl(): string {
  // Detect "server" vs "browser"
  const isBrowser = typeof window !== "undefined";

  if (isBrowser) {
    // Browser can't resolve container hostnames – keep it same-origin.
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/ws`; // proxy route we created
  }

  if (process.env["NODE_ENV"] === "development") {
    return "ws://localhost:8000";
  } else {
    return "ws://server:8000";
  }
}

/**
 * Generate API URL based on environment
 * Uses Docker internal network (server:8000) in production/Docker environments
 * Uses localhost:8000 in development mode
 * This is for server-side API calls (during SSR, API routes, Server Actions)
 *
 * RECOMMENDED USAGE PATTERN:
 * - Use this for: Initial data loading, mutations, sensitive operations
 * - Use getClientApiUrl() for: Real-time updates, frequent polling, user interactions
 */
export function getApiUrl(): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // Development mode: use localhost
    return "http://localhost:8000";
  } else {
    // Production/Docker mode: use Docker internal network
    return "http://server:8000";
  }
}
