import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  const serverPort = process.env["SERVER_PORT"] || "8000";
  return `http://localhost:${serverPort}`;
}
