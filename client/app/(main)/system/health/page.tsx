/**
 * app/(main)/system/health/page.tsx
 * Health monitoring page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import Health from "@/components/system/health/Health";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Health",
  description: "Monitor system health and performance",
};

export default function HealthPage() {
  return <Health />;
}
