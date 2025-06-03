/**
 * app/profile/page.tsx
 * Profile list page - redirects to home with profiles section
 */
"use client";
import React from "react";
import { ProfilesContent } from "@/components/admin/profiles-content";

export default function ChatProfilesPage() {
  return (
    <div className="space-y-6">
      
      <ProfilesContent />
    </div>
  );
}
