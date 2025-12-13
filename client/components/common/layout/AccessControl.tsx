/**
 * AccessControl.tsx
 * Simplified component - access control is now handled server-side in layout.tsx
 * This component just passes through children since access is already validated
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import React from "react";

interface AccessControlProps {
  children: React.ReactNode;
  pathname: string;
}

/**
 * Access control is now handled server-side in layout.tsx
 * This component just passes through children since access is already validated
 */
export function AccessControl({ children }: AccessControlProps) {
  // Access control is handled server-side, just render children
  return <>{children}</>;
}
