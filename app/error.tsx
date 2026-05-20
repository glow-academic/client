"use client";
import { createFeedback } from "@/lib/actions/feedback";
import ReportProblem from "@/components/common/layout/ReportProblem";
import { Button } from "@/components/ui/button";
import { ProfileContext } from "@/contexts/profile-context";
import { Bug, Copy, Check } from "lucide-react";
import Link from "next/link";
import { useContext, useState } from "react";

export default function Error({
  error,
  reset: _reset,
}: {
  // Next.js attaches a stable `digest` to Server Component errors so the
  // production-stripped message still has a server-log correlation key.
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Use useContext directly instead of useProfile() to avoid throwing and masking real errors
  const profileContext = useContext(ProfileContext);
  const profile = profileContext?.profile ?? null;
  const [copied, setCopied] = useState(false);

  const backHref =
    profile?.role && profile.role !== "member" && profile.role !== "guest"
      ? "/analytics"
      : "/home";

  // Build a single diagnostic blob — everything an engineer needs to
  // reproduce the bug from the user's report, in one paste.
  const url = typeof window !== "undefined" ? window.location.href : "Unknown";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "Unknown";
  const ts = new Date().toISOString();
  const diagnostic = [
    `Timestamp: ${ts}`,
    `URL:       ${url}`,
    `Digest:    ${error.digest ?? "(none)"}`,
    `Message:   ${error.message || "(production-stripped)"}`,
    `User:      ${profile?.id ?? "(unauthenticated)"}`,
    `Agent:     ${ua}`,
    error.stack ? `\nStack:\n${error.stack}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const copyDiagnostic = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context). Fall through silently.
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
            {/* In production Next.js strips the real message — only the
                digest survives. Show it prominently so a paste here +
                a server-log grep can match. */}
            {error.digest && (
              <p className="text-xs font-mono text-muted-foreground">
                Reference: <span className="select-all">{error.digest}</span>
              </p>
            )}
            {error.message && (
              <p className="text-muted-foreground text-sm break-words">
                {error.message}
              </p>
            )}
            <details className="mt-4 text-left">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Diagnostic detail
              </summary>
              <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-64 p-2 bg-muted rounded whitespace-pre-wrap">
                {diagnostic}
              </pre>
            </details>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={copyDiagnostic}
            type="button"
          >
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? "Copied" : "Copy diagnostic"}
          </Button>
          <ReportProblem
            createFeedback={createFeedback}
            initialType="bug"
            initialMessage={diagnostic}
          >
            <Button variant="outline" className="w-full">
              <Bug className="h-4 w-4 mr-2" />
              Report This Error
            </Button>
          </ReportProblem>
          <Link
            href={backHref}
            prefetch={false}
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors text-center"
          >
            Back to Glow
          </Link>
        </div>

        {/* Additional Help */}
        <div className="text-xs text-muted-foreground">
          <p>If you believe this is an error, please contact support.</p>
        </div>
      </div>
    </div>
  );
}
