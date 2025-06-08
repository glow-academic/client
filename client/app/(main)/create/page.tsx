"use client";

/**
 * Create page. This is the main page for the create section.
 */
import { redirect } from "next/navigation";

export default function CreatePage() {
  return redirect("/create/simulations");
}