"use client";

/**
 * Analytics page. This is the main page for the analytics section.
 */
import { redirect } from "next/navigation";

export default function AnalyticsPage() {
  return redirect("/analytics/overview");
}