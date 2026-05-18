/**
 * app/(main)/layout.tsx
 * Minimal layout — auth check only.
 * Each page renders its own full DOM via FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { getSession } from "@/auth";
import { AppShell } from "@/components/common/layout/AppShell";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { headers } from "next/headers";
import { Suspense } from "react";
import { LogoutGuard } from "./logout-guard";
import { MainProviders } from "./providers";

// Force dynamic rendering to ensure layout re-renders on route changes
// This fixes the issue where children don't update on client-side navigation
export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "/";

  // No session → full-width access denied (no sidebar)
  if (!session?.id_token) {
    return (
      <LogoutGuard>
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname={pathname}
          fullWidth={true}
        />
      </LogoutGuard>
    );
  }

  return (
    <MainProviders
      profileId={session.user?.id ?? null}
      idToken={session.id_token ?? null}
    >
      <Suspense
        key={`suspense-${pathname}`}
        fallback={<AppShell.ContentSkeleton />}
      >
        {children}
      </Suspense>
    </MainProviders>
  );
}
