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
          {/* Glow Brand */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Glow</h1>
            <p className="text-sm text-muted-foreground">
              Graduate Learning Orientation Workshop
            </p>
          </div>

          {/* 404 Icon */}
          <div className="mx-auto w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.291-1.007-5.691-2.709M15 11V9a6 6 0 10-12 0v2m5.121 9.121A2.992 2.992 0 0010 21a2.992 2.992 0 002.121-.879z"
              />
            </svg>
          </div>

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
