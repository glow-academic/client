/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */
import { getSession } from "@/auth";

import Info from "@/components/home/Info";
import { ThemeHydrator } from "@/components/theme/ThemeHydrator";
import { api } from "@/lib/api/client";
import type { OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

type SettingsActiveOut = OutputOf<"/api/v3/settings/active", "post">;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GLOW",
    description:
      "GLOW - Graduate Learning Orientation Workshop. AI-powered simulation platform for teaching assistant training and pedagogical development. Practice student interactions, improve teaching techniques, and enhance learning and development skills through realistic educational scenarios.",
  };
}

async function getActiveSettings(): Promise<SettingsActiveOut | null> {
  try {
    return (await api.post(
      "/settings/active",
      {
        body: {
          profileId: "guest-profile-id",
        },
      },
      {
        cache: "no-store",
        headers: {
          "X-Bypass-Cache": "1",
        },
      }
    )) as SettingsActiveOut;
  } catch {
    // If settings fetch fails, return null - theme will use defaults
    return null;
  }
}

export default async function InfoPage() {
  const session = await getSession();
  // Check if user is logged in: effectiveProfileId exists and is not guest-profile-id
  const isLoggedIn =
    !!session?.effectiveProfileId &&
    session.effectiveProfileId !== "guest-profile-id";

  // Fetch default settings for guest/unauthenticated users
  const activeSettings = await getActiveSettings();

  return (
    <>
      <ThemeHydrator activeSettings={activeSettings} />
      <Info isLoggedIn={isLoggedIn} activeSettings={activeSettings} />
    </>
  );
}
