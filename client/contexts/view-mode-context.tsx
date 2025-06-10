"use client";
import React from "react";

// Create context for view mode
const ViewModeContext = React.createContext<{
  viewMode: "chats" | "attempts";
  setViewMode: (mode: "chats" | "attempts") => void;
} | null>(null);

export const useViewMode = () => {
  const context = React.useContext(ViewModeContext);
  if (!context) {
    throw new Error("useViewMode must be used within ViewModeProvider");
  }
  return context;
};

export const ViewModeProvider = ({
  children,
  viewMode,
  setViewMode,
}: {
  children: React.ReactNode;
  viewMode: "chats" | "attempts";
  setViewMode: (mode: "chats" | "attempts") => void;
}) => {
  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};
