/**
 * app/(main)/analytics/page.tsx
 * Analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { redirect } from "next/navigation";

export default function AnalyticsPage() {
    return redirect("/analytics/overview");
}