"use client";
import { createFeedback } from "@/app/(main)/layout-server";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Button } from "@/components/ui/button";
import { ProfileContext } from "@/contexts/profile-context";
import { Bug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext } from "react";

export default function Error({
  error,
  reset: _reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  // Use useContext directly instead of useProfile() to avoid throwing and masking real errors
  const profileContext = useContext(ProfileContext);
  const effectiveProfile = profileContext?.effectiveProfile ?? null;

  const handleBackToGlow = () => {
    // Navigate based on effective role if available, otherwise default to home
    if (
      effectiveProfile?.role &&
      effectiveProfile.role !== "ta" &&
      effectiveProfile.role !== "guest"
    ) {
      router.push("/analytics");
    } else {
      router.push("/home");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-secondary/30 px-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-lg border border-border text-center">
        <div className="space-y-4">
          {/* Error Message */}
          <div className="space-y-2">
            <h2 className="text-6xl font-bold text-muted-foreground/50">
              Error
            </h2>
            <h3 className="text-xl font-semibold text-foreground">
              An error occurred
            </h3>
            <p className="text-muted-foreground text-sm break-words">
              {error.message}
            </p>
            {error.stack && (
              <details className="mt-4 text-left">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                  Stack Trace
                </summary>
                <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-48 p-2 bg-muted rounded">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <ReportProblem
            createFeedback={createFeedback}
            initialType="bug"
            initialMessage={`Error occurred on page: ${error.message}\n\nError Stack: ${error.stack || "No stack trace available"}\n\nPage URL: ${typeof window !== "undefined" ? window.location.href : "Unknown"}`}
          >
            <Button variant="outline" className="w-full">
              <Bug className="h-4 w-4 mr-2" />
              Report This Error
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
          <p>If you believe this is an error, please contact support.</p>
        </div>
      </div>
    </div>
  );
}
