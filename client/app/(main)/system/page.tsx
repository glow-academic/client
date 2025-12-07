/**
 * app/(main)/system/page.tsx
 * System page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { redirect } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "System",
    description: "System administration hub for teaching assistant training platform. Manage authentication methods, API keys, system health monitoring, feedback collection, and platform configuration for educational institutions and L&D programs.",
  };
}

export default function SystemPage() {
  return redirect("/system/auth");
}
