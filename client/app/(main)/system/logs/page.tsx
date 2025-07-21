/**
 * app/(main)/management/system/page.tsx
 * System page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import ConnectionStatusIndicator from "@/components/system/health/ConnectionStatusIndicator";
import Logs from "@/components/system/logs/Logs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System",
  description: `Manage system in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function SystemPage() {
  return (
    <div className="space-y-6">
      <ConnectionStatusIndicator />
      <Logs />
    </div>
  );
}
