"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

/**
 * Entity metadata for breadcrumb enrichment
 */
interface EntityMetadata {
  entityId: string;
  entityName: string;
  entityType:
    | "persona"
    | "cohort"
    | "scenario"
    | "simulation"
    | "document"
    | "profile"
    | "parameter"
    | "rubric"
    | "department"
    | "agent"
    | "provider"
    | "model"
    | "chat"
    | "attempt";
}

/**
 * Breadcrumb context type
 */
interface BreadcrumbContextType {
  setEntityMetadata: (metadata: EntityMetadata) => void;
  clearEntityMetadata: () => void;
  getEntityName: (entityId: string) => string | undefined;
}

const BreadcrumbContext = createContext<BreadcrumbContextType | undefined>(
  undefined
);

/**
 * Provider component for breadcrumb entity metadata
 */
export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entityMap, setEntityMap] = useState<Map<string, string>>(new Map());

  const setEntityMetadata = useCallback((metadata: EntityMetadata) => {
    setEntityMap((prev) => {
      const next = new Map(prev);
      next.set(metadata.entityId, metadata.entityName);
      return next;
    });
  }, []);

  const clearEntityMetadata = useCallback(() => {
    setEntityMap(new Map());
  }, []);

  const getEntityName = useCallback(
    (entityId: string) => {
      return entityMap.get(entityId);
    },
    [entityMap]
  );

  return (
    <BreadcrumbContext.Provider
      value={{ setEntityMetadata, clearEntityMetadata, getEntityName }}
    >
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook to access breadcrumb context
 */
export function useBreadcrumbContext() {
  const context = useContext(BreadcrumbContext);
  if (!context) {
    throw new Error(
      "useBreadcrumbContext must be used within a BreadcrumbProvider"
    );
  }
  return context;
}
