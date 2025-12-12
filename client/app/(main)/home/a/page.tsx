/**
 * app/a/page.tsx
 * Attempts page. Redirects to new attempt page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Attempts",
    description:
      "View and manage teaching practice sessions and simulation attempts. Track pedagogical performance, review student interaction strategies, and monitor teaching effectiveness through comprehensive learning analytics.",
  };
}

export default function AttemptPage() {
  return redirect("/home");
}
