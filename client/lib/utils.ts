import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate WebSocket URL based on environment
 * For browser connections, must use external URLs in production
 * Uses localhost in development mode
 */
export function getWebSocketUrl(): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // Development mode: use localhost with WebSocket protocol
    return "ws://localhost:8000";
  } else {
    // Production mode: derive WebSocket URL from the public API URL
    const apiUrl =
      process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000";

    // Convert HTTP/HTTPS to WS/WSS for WebSocket connections
    if (apiUrl.startsWith("https://")) {
      return apiUrl.replace("https://", "wss://").replace("/server", "");
    } else if (apiUrl.startsWith("http://")) {
      return apiUrl.replace("http://", "ws://").replace("/server", "");
    } else {
      return "ws://localhost:8000";
    }
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

/**
 * Generate client-side API URL based on environment
 * Uses the public API URL for browser-based requests
 * In production, browsers must use external URLs (via Traefik/load balancer)
 * Falls back to development localhost if not set
 */
export function getClientApiUrl(): string {
  // For browser-based requests, always use the public API URL
  // This ensures browsers can reach the API from outside the Docker network
  return process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000";
}
