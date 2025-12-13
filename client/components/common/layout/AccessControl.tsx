/**
 * AccessControl.tsx
 * Simplified component - access control is now handled server-side in layout.tsx
 * This component just passes through children since access is already validated
 * 
 * IMPORTANT: This is intentionally a passthrough component. All access control
 * logic happens server-side in layout.tsx before children are rendered. This component
 * provides a clear boundary in the component tree but doesn't perform any access checks.
 * 
 * If access is denied, layout.tsx renders UnifiedAccessDenied instead of children,
 * so this component never receives children for unauthorized routes.
 * 
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import React from "react";

interface AccessControlProps {
  children: React.ReactNode;
  pathname: string;
}

/**
 * Access control is handled server-side in layout.tsx
 * This component just passes through children since access is already validated
 */
export function AccessControl({ children }: AccessControlProps) {
  // Access control is handled server-side, just render children
  // By the time we reach here, access has already been validated in layout.tsx
  return <>{children}</>;
}
