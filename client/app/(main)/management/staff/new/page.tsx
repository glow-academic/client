/**
 * app/(main)/management/staff/new/page.tsx
 * Staff creation page for the staff section.
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */
import NewStaff from "@/components/management/staff/NewStaff";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Staff",
  description: `Create a new staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function FeedbackPage() {
  return (
    <div className="space-y-6">
      <NewStaff />
    </div>
  );
}
