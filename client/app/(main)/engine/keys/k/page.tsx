/**
 * app/(main)/engine/keys/k/page.tsx
 * Key page for the keys section. Redirects to keys page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Keys",
  description: `Keys in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function KeyPage() {
  return redirect("/engine/keys");
}

