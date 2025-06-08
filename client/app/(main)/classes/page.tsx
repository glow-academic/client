"use client";

/**
 * Classes page. This is the main page for the classes section.
 */
import { redirect } from "next/navigation";

export default function ClassesPage() {
  return redirect("/classes/new");
}