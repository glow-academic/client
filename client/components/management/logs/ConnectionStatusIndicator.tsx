/**
 * ConnectionStatusIndicator.tsx
 * Component to display connection status indicators for WebSocket
 * @AshokSaravanan222 & @siladiea
 * 07/03/2025
 */
"use client";
import { useWebSocket } from "@/contexts/websocket-context";

export default function ConnectionStatusIndicator() {
  const { isConnected, } = useWebSocket();

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2">
      <div
        className={`px-3 py-1 rounded-full text-xs font-medium shadow-lg transition-all duration-300 ${
          isConnected
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-red-500"
            } ${isConnected ? "animate-pulse" : ""}`}
          />
          {isConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
        </div>
      </div>
    </div>
  );
}
