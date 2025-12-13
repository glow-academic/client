/**
 * AccessControl.tsx
 * Component for handling route access control and displaying access denied messages
 * Now uses server-side permissions from profile context for enhanced security
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useProfile } from "@/contexts/profile-context";
import { hasRouteAccess } from "@/utils/route-permissions";
import { AlertTriangle, Home, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

interface AccessControlProps {
  children: React.ReactNode;
  pathname: string;
}

export function AccessControl({ children, pathname }: AccessControlProps) {
  const { effectiveProfile, isLoading, redirectPath } = useProfile();
  const [showAccessDenied, setShowAccessDenied] = React.useState(false);

  // Add a small delay to prevent flickering access denied screens during profile transitions
  React.useEffect(() => {
    // Only proceed if we're not loading AND we have a complete profile with a role
    if (isLoading || !effectiveProfile || !effectiveProfile.role) {
      setShowAccessDenied(false);
      return;
    }

    // Small delay to prevent flickering during profile transitions
    const timer = setTimeout(() => {
      // Use route permissions check (more accurate than section check)
      // This handles cases like TA accessing /leaderboard
      const role = effectiveProfile.role as
        | "guest"
        | "ta"
        | "instructional"
        | "admin"
        | "superadmin";
      const hasAccess = hasRouteAccess(pathname, role);

      if (!hasAccess) {
        setShowAccessDenied(true);
      } else {
        setShowAccessDenied(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [effectiveProfile, pathname, isLoading]);

  // If still loading, show loading state instead of access denied
  // Also show loading if we don't have a profile yet (prevents premature access denied)
  if (isLoading || !effectiveProfile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            {isLoading ? "Loading..." : "Initializing..."}
          </p>
        </div>
      </div>
    );
  }

  // Additional safety check: ensure we have a valid role
  if (!effectiveProfile.role) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading user permissions...</p>
        </div>
      </div>
    );
  }

  // Check if user has access to the current route
  if (showAccessDenied) {
    return (
      <AccessDeniedCard
        role={effectiveProfile.role}
        pathname={pathname}
        redirectPath={redirectPath}
      />
    );
  }

  // User has access, render children
  return <>{children}</>;
}

interface AccessDeniedCardProps {
  role: string;
  pathname: string;
  redirectPath: string;
}

function AccessDeniedCard({
  role,
  pathname,
  redirectPath,
}: AccessDeniedCardProps) {
  const router = useRouter();

  const handleRedirect = () => {
    router.push(redirectPath);
  };

  const getAccessDeniedMessage = (role: string, pathname: string) => {
    const section = pathname.split("/")[1];

    switch (role) {
      case "guest":
        return "You need to log in to access this page.";
      case "ta":
        if (
          section === "analytics" ||
          section === "create" ||
          section === "management" ||
          section === "system"
        ) {
          return "This page is only available to instructional staff and administrators.";
        }
        return "You don't have permission to access this page.";
      case "instructional":
        if (section === "management" || section === "system") {
          return "This page is only available to administrators.";
        }
        return "You don't have permission to access this page.";
      case "admin":
        if (section === "system") {
          return "This page is only available to super administrators.";
        }
        return "You don't have permission to access this page.";
      default:
        return "You don't have permission to access this page.";
    }
  };

  const getIcon = (role: string) => {
    switch (role) {
      case "guest":
        return <User className="h-8 w-8 text-muted-foreground" />;
      case "ta":
        return <User className="h-8 w-8 text-blue-500" />;
      case "instructional":
        return <Shield className="h-8 w-8 text-green-500" />;
      case "admin":
        return <Shield className="h-8 w-8 text-orange-500" />;
      case "superadmin":
        return <Shield className="h-8 w-8 text-red-500" />;
      default:
        return <AlertTriangle className="h-8 w-8 text-muted-foreground" />;
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">{getIcon(role)}</div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              {getAccessDeniedMessage(role, pathname)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col gap-2">
              <Button onClick={handleRedirect} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Button>

              {role === "guest" && (
                <Button
                  variant="outline"
                  onClick={() => router.push("/")}
                  className="w-full"
                >
                  Log In
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
