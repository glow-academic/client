import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate WebSocket URL based on environment
 * Converts HTTP/HTTPS API URLs to appropriate WebSocket protocols
 * Removes /server path since WebSocket is handled at root level
 */
export function getWebSocketUrl(): string {
  const apiUrl = process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:8000";
  
  let wsUrl: string;
  
  // If we're in production (using HTTPS), use WSS
  if (apiUrl.startsWith("https://")) {
    wsUrl = apiUrl.replace("https://", "wss://");
  }
  // If we're in development (using HTTP), use WS
  else if (apiUrl.startsWith("http://")) {
    wsUrl = apiUrl.replace("http://", "ws://");
  }
  // Fallback for localhost
  else {
    wsUrl = "ws://localhost:8000";
  }
  
  // Remove /server path from WebSocket URL since Socket.IO is at root level
  wsUrl = wsUrl.replace("/server", "");
  
  return wsUrl;
}
