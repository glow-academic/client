"use client";

import type { InsightsResponse } from "@/app/(main)/layout-server";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type InsightItem = NonNullable<InsightsResponse["insights"]>[number];

interface InsightsContextType {
  insights: InsightItem[];
  addInsight: (item: InsightItem) => void;
}

const InsightsContext = createContext<InsightsContextType | null>(null);

export function useInsights(): InsightsContextType {
  const context = useContext(InsightsContext);
  if (!context) {
    throw new Error("useInsights must be used within an InsightsProviderClient");
  }
  return context;
}

export function InsightsProviderClient({
  children,
  insights: initialInsights,
}: {
  children: React.ReactNode;
  insights: InsightItem[];
}) {
  const [insights, setInsights] = useState<InsightItem[]>(initialInsights);

  const addInsight = useCallback((item: InsightItem) => {
    setInsights((prev) => [item, ...prev]);
  }, []);

  const value = useMemo<InsightsContextType>(
    () => ({ insights, addInsight }),
    [insights, addInsight]
  );

  return (
    <InsightsContext.Provider value={value}>{children}</InsightsContext.Provider>
  );
}
