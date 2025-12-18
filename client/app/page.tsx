/**
 * app/page.tsx
 * This is the homepage.
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
 */

import Info from "@/components/home/Info";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "GLOW",
    description:
      "GLOW - Graduate Learning Orientation Workshop. AI-powered simulation platform for teaching assistant training and pedagogical development. Practice student interactions, improve teaching techniques, and enhance learning and development skills through realistic educational scenarios.",
  };
}

export default async function InfoPage() {
  return <Info />;
}
