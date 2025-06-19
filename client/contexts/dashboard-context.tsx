/**
 * DashboardContext.tsx
 * This context is used to store the state of the dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/19/2025
 */

import { createContext, useContext, useState } from "react";

interface DashboardContextType {
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;
}


export const DashboardContext = createContext<DashboardContextType | null>(null);

export const useDashboard = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
};

export const DashboardProvider = ({ children }: { children: React.ReactNode }) => {
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <DashboardContext.Provider value={{ isEditMode, setIsEditMode }}>
      {children}
    </DashboardContext.Provider>
  );
};