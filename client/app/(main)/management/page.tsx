/**
 * app/(main)/management/page.tsx
 * Management page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { redirect } from "next/navigation";

export default function ManagementPage() {
  return redirect("/management/staff");
}
