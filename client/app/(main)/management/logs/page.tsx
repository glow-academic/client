/**
 * app/(main)/management/logs/page.tsx
 * Logs list page - redirects to home with logs section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import ActivityStatus from "@/components/management/logs/ActivityStatus";
import ConnectionStatusIndicator from "@/components/management/logs/ConnectionStatusIndicator";
import Feedback from "@/components/management/logs/Feedback";
import Logs from "@/components/management/logs/Logs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Logs",
  description:
    `Manage logs in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <ConnectionStatusIndicator />
      <ActivityStatus />
      <Feedback />
      <Logs />
    </div>
  );
}
