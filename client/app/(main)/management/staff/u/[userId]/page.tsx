/**
 * app/(main)/management/staff/u/[userId]/page.tsx
 * Staff edit page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import StaffEdit from "@/components/management/staff/StaffEdit";
import { use } from "react";

export default function StaffEditPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  return <div className="space-y-6"><StaffEdit userId={userId} /></div>;
}