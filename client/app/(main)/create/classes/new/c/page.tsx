/**
 * app/(main)/classes/new/c/page.tsx
 * Class page for the classes section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Class",
  description: `New class creation page for the classes section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ClassPageNew() {
  return redirect("/create/classes/new");
}
