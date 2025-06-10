"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/contexts/role-context";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  const router = useRouter();
  const { effectiveRole } = useRole();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

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

          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-muted-foreground text-sm">
              We encountered an unexpected error. Please try again or return to the main page.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>

          <button
            onClick={handleBackToGlow}
            className="w-full py-2 px-4 border border-input rounded-md shadow-sm text-sm font-medium text-foreground bg-background hover:bg-accent transition-colors"
          >
            Back to Glow
          </button>
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === "development" && (
          <details className="mt-4 text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
