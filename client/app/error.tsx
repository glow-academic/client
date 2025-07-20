"use client";
import { useProfile } from "@/contexts/profile-context";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();

  const handleBackToGlow = () => {
    // Navigate based on effective role
    if (effectiveProfile?.role !== "ta" && effectiveProfile?.role !== "guest") {
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
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-secondary-foreground bg-secondary hover:bg-secondary/90 transition-colors"
          >
            Try Again
          </button>
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
