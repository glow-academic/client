/**
 * app/(main)/management/logs/page.tsx
 * Logs list page - redirects to home with logs section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Logs from "@/components/management/logs/Logs";
import ConnectionStatusIndicator from "@/components/management/logs/ConnectionStatusIndicator";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logs",
  description: "Manage logs in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <ConnectionStatusIndicator />
      <Logs />
    </div>
  );
}
