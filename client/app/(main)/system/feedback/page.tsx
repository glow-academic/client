/**
 * app/(main)/system/feedback/page.tsx
 * Feedback list page - redirects to home with feedback section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Feedback from "@/components/feedback/Feedback";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Feedback",
  description: `Manage feedback in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function FeedbackPage() {
  return (
    <div className="space-y-6">
      <Feedback />
    </div>
  );
}
