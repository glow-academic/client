"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

interface FilterOptionItem {
  value: string;
  label: string | null;
  count: number | null;
}

interface FilterOptionsState {
  cohortOptions: FilterOptionItem[];
  departmentOptions: FilterOptionItem[];
  dateRangeEarliest: string | null;
  dateRangeLatest: string | null;
}

interface FilterOptionsContextType {
  options: FilterOptionsState | null;
  setOptions: (options: FilterOptionsState) => void;
  clearOptions: () => void;
}

const FilterOptionsContext = createContext<FilterOptionsContextType | undefined>(
  undefined
);

export function FilterOptionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [options, setOptionsState] = useState<FilterOptionsState | null>(null);

  const setOptions = useCallback((opts: FilterOptionsState) => {
    setOptionsState(opts);
  }, []);

  const clearOptions = useCallback(() => {
    setOptionsState(null);
  }, []);

  return (
    <FilterOptionsContext.Provider value={{ options, setOptions, clearOptions }}>
      {children}
    </FilterOptionsContext.Provider>
  );
}

export function useFilterOptions() {
  const context = useContext(FilterOptionsContext);
  if (!context) {
    throw new Error(
      "useFilterOptions must be used within a FilterOptionsProvider"
    );
  }
  return context;
}
