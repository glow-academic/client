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

  // Save function for edit mode
  saveChanges: (() => Promise<void>) | null;
  setSaveChanges: (saveChanges: (() => Promise<void>) | null) => void;
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
  const [saveChanges, setSaveChanges] = useState<(() => Promise<void>) | null>(
    null
  );

  const value: DashboardContextType = {
    isEditMode,
    setIsEditMode,
    saveChanges,
    setSaveChanges,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
