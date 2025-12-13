"use client";
import { createFeedback } from "@/app/(main)/layout-server";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Button } from "@/components/ui/button";
import { ProfileContext } from "@/contexts/profile-context";
import { Bug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";

export default function NotFound() {
  const router = useRouter();

  // Try to get profile context, but handle gracefully if not available
  // (not-found.tsx can render outside the layout hierarchy)
  // useContext returns null if context is not provided, which is safe
  const profileContext = useContext(ProfileContext);
  const effectiveProfile = profileContext?.effectiveProfile ?? null;

  const handleBackToGlow = () => {
    // Navigate based on effective role, default to /home if context unavailable
    if (effectiveProfile?.role !== "member" && effectiveProfile?.role !== "guest") {
      router.push("/analytics");
    } else {
      router.push("/home");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg border border-border text-center">
        <div className="space-y-4">
          {/* 404 Message */}
          <div className="space-y-2">
            <h2 className="text-6xl font-bold text-muted-foreground/50">404</h2>
            <h3 className="text-xl font-semibold text-foreground">
              Page Not Found
            </h3>
            <p className="text-muted-foreground text-sm">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <ReportProblem
            createFeedback={createFeedback}
            initialType="bug"
            initialMessage={`404 Error - Page Not Found\n\nRequested URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}\n\nUser Agent: ${typeof window !== "undefined" ? window.navigator.userAgent : "Unknown"}\n\nTimestamp: ${new Date().toISOString()}`}
          >
            <Button variant="outline" className="w-full">
              <Bug className="h-4 w-4 mr-2" />
              Report This Issue
            </Button>
          </ReportProblem>
          <button
            onClick={handleBackToGlow}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
          >
            Back to Glow
          </button>
        </div>

        {/* Additional Help */}
        <div className="text-xs text-muted-foreground">
          <p>
            If you believe this is an error, please contact support or try
            refreshing the page.
          </p>
        </div>
      </div>
    </div>
  );
}
