/**
 * app/(main)/system/keys/k/page.tsx
 * Key page for the keys section. Redirects to keys page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Keys",
    description: "Manage API keys and authentication credentials for teaching assistant training platform. Configure secure access keys, manage API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}

export default function KeyPage() {
  return redirect("/system/keys");
}
