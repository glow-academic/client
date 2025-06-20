/**
 * DashboardContext.tsx
 * Simplified context for basic dashboard state management
 * @AshokSaravanan222 & @siladiea
 * 06/19/2025
 */
"use client";
import { createContext, useContext, useState } from "react";

interface DashboardContextType {
  // Basic edit mode
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
}

export const DashboardContext = createContext<DashboardContextType | null>(
  null
);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};

export const DashboardProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isEditMode, setIsEditMode] = useState(false);

  const value: DashboardContextType = {
    isEditMode,
    setIsEditMode,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
