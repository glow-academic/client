/**
 * app/(main)/platform/page.tsx
 * Platform page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Platform",
    description:
      "Platform administration hub for teaching assistant training platform. Manage authentication methods, API keys, system health monitoring, feedback collection, and platform configuration for educational institutions and L&D programs.",
  };
}

export default function PlatformPage() {
  return redirect("/platform/auth");
}
