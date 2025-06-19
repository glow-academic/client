/**
 * DashboardContext.tsx
 * This context is used to store the state of the dashboard
 * @AshokSaravanan222 & @siladiea
 * 06/19/2025
 */

import { logError } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

interface DashboardComponent {
  id: string;
  name: string;
  fileName: string;
  layout: Record<string, unknown>;
}

interface DashboardConfig {
  id: string;
  headerComponentIds: string[];
  primaryComponentIds: string[];
  secondaryComponentIds: string[];
  footerComponentIds: string[];
  autoScroll: boolean;
  showIndicators: boolean;
  headerComponents: number;
  mainSplit: number;
  footerSplit: number;
}

interface DashboardContextType {
  // Basic edit mode
  isEditMode: boolean;
  setIsEditMode: (isEditMode: boolean) => void;

  // Dashboard configuration
  dashboardConfig: DashboardConfig | null;
  setDashboardConfig: (config: DashboardConfig | null) => void;

  // Available components
  availableComponents: DashboardComponent[];
  setAvailableComponents: (components: DashboardComponent[]) => void;

  // Component management
  addComponentToSection: (
    componentId: string,
    section: keyof Pick<
      DashboardConfig,
      | "headerComponentIds"
      | "primaryComponentIds"
      | "secondaryComponentIds"
      | "footerComponentIds"
    >
  ) => void;
  removeComponentFromSection: (
    componentId: string,
    section: keyof Pick<
      DashboardConfig,
      | "headerComponentIds"
      | "primaryComponentIds"
      | "secondaryComponentIds"
      | "footerComponentIds"
    >
  ) => void;
  moveComponent: (
    componentId: string,
    fromSection: string,
    toSection: string,
    toIndex?: number
  ) => void;

  // Settings management
  updateSettings: (
    settings: Partial<
      Pick<
        DashboardConfig,
        | "autoScroll"
        | "showIndicators"
        | "headerComponents"
        | "mainSplit"
        | "footerSplit"
      >
    >
  ) => void;

  // Sidebar state
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Auto-save
  saveChanges: () => Promise<void>;
  isSaving: boolean;
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
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [availableComponents, setAvailableComponents] = useState<
    DashboardComponent[]
  >([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveChanges = useCallback(async () => {
    if (!dashboardConfig || !session?.user?.id) return;

    setIsSaving(true);
    try {
      // Here you would make your API call to update the dashboard
      // For now, I'll simulate with a delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });

      toast.success("Dashboard saved successfully");
    } catch (error) {
      logError("Failed to save dashboard", error);
      toast.error("Failed to save dashboard");
    } finally {
      setIsSaving(false);
    }
  }, [dashboardConfig, session?.user?.id, queryClient]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveChanges();
    }, 1000); // 1 second debounce
  }, [saveChanges]);

  const addComponentToSection = useCallback(
    (
      componentId: string,
      section: keyof Pick<
        DashboardConfig,
        | "headerComponentIds"
        | "primaryComponentIds"
        | "secondaryComponentIds"
        | "footerComponentIds"
      >
    ) => {
      if (!dashboardConfig) return;

      // Remove from available components
      setAvailableComponents((prev) =>
        prev.filter((comp) => comp.id !== componentId)
      );

      // Add to section
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: [...prev[section], componentId],
        };
      });

      debouncedSave();
    },
    [dashboardConfig, debouncedSave]
  );

  const removeComponentFromSection = useCallback(
    (
      componentId: string,
      section: keyof Pick<
        DashboardConfig,
        | "headerComponentIds"
        | "primaryComponentIds"
        | "secondaryComponentIds"
        | "footerComponentIds"
      >
    ) => {
      if (!dashboardConfig) return;

      // Find the component to add back to available
      // This would need to be populated from your components query
      const component = availableComponents.find(
        (comp) => comp.id === componentId
      );
      if (component) {
        setAvailableComponents((prev) => [...prev, component]);
      }

      // Remove from section
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [section]: prev[section].filter((id) => id !== componentId),
        };
      });

      debouncedSave();
    },
    [dashboardConfig, availableComponents, debouncedSave]
  );

  const moveComponent = useCallback(
    (
      componentId: string,
      fromSection: string,
      toSection: string,
      toIndex?: number
    ) => {
      if (!dashboardConfig) return;

      setDashboardConfig((prev) => {
        if (!prev) return prev;

        const newConfig = { ...prev };
        const fromKey = fromSection as keyof Pick<
          DashboardConfig,
          | "headerComponentIds"
          | "primaryComponentIds"
          | "secondaryComponentIds"
          | "footerComponentIds"
        >;
        const toKey = toSection as keyof Pick<
          DashboardConfig,
          | "headerComponentIds"
          | "primaryComponentIds"
          | "secondaryComponentIds"
          | "footerComponentIds"
        >;

        // Remove from source
        newConfig[fromKey] = newConfig[fromKey].filter(
          (id) => id !== componentId
        );

        // Add to destination
        if (toIndex !== undefined) {
          newConfig[toKey].splice(toIndex, 0, componentId);
        } else {
          newConfig[toKey].push(componentId);
        }

        return newConfig;
      });

      debouncedSave();
    },
    [dashboardConfig, debouncedSave]
  );

  const updateSettings = useCallback(
    (
      settings: Partial<
        Pick<
          DashboardConfig,
          | "autoScroll"
          | "showIndicators"
          | "headerComponents"
          | "mainSplit"
          | "footerSplit"
        >
      >
    ) => {
      setDashboardConfig((prev) => {
        if (!prev) return prev;
        return { ...prev, ...settings };
      });

      // Don't auto-save settings - they'll be saved explicitly
    },
    []
  );

  const value: DashboardContextType = {
    isEditMode,
    setIsEditMode,
    dashboardConfig,
    setDashboardConfig,
    availableComponents,
    setAvailableComponents,
    addComponentToSection,
    removeComponentFromSection,
    moveComponent,
    updateSettings,
    sidebarOpen,
    setSidebarOpen,
    saveChanges,
    isSaving,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};
