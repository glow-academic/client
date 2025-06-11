"use client";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/role-context";

export default function NotFound() {
  const router = useRouter();
  const { effectiveRole } = useRole();

  const handleBackToGlow = () => {
    // Navigate based on effective role
    if (effectiveRole === "admin") {
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

        {/* Action Button */}
        <div>
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
