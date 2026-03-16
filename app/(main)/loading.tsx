/**
 * app/(main)/loading.tsx
 * Segment-level loading state for (main) route group
 * Shows sidebar skeleton + header skeleton + content skeleton
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { AppShell } from "@/components/common/layout/AppShell";

export default function Loading() {
  // Show the same overall look while this segment is loading.
  // This renders sidebar skeleton + header skeleton + content skeleton.
  return <AppShell.FullShellSkeleton />;
}
