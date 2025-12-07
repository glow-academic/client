/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";

import Info from "@/components/home/Info";
import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GLOW",
    description:
      "GLOW - Graduate Learning Orientation Workshop. AI-powered simulation platform for teaching assistant training and pedagogical development. Practice student interactions, improve teaching techniques, and enhance learning and development skills through realistic educational scenarios.",
  };
}

export default async function InfoPage() {
  const session = await getSession();
  // Check if user is logged in: effectiveProfileId exists and is not guest-profile-id
  const isLoggedIn =
    !!session?.effectiveProfileId &&
    session.effectiveProfileId !== "guest-profile-id";

  return <Info isLoggedIn={isLoggedIn} />;
}
