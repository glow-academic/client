/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Home from "@/components/home/Home";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home",
  description: "Home page for GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Home />
    </div>
  );
}
