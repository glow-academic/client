/**
 * app/(main)/management/parameters/p/page.tsx
 * Parameter page for the parameters section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Parameters",
    description: "Manage system parameters and configuration settings for teaching assistant training platform. Configure platform-wide parameters, learning environment settings, and system-wide configurations for effective L&D program administration.",
  };
}

export default function ParameterPage() {
  return redirect("/management/parameters/new");
}
