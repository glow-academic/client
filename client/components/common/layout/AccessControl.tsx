/**
 * AccessControl.tsx
 * Component for handling route access control and displaying access denied messages
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
import {
  getRedirectPathForRole,
  hasRouteAccess,
} from "@/utils/route-permissions";
import { AlertTriangle, Home, Shield, User } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

interface AccessControlProps {
  children: React.ReactNode;
  pathname: string;
}

export function AccessControl({ children, pathname }: AccessControlProps) {
  const { effectiveProfile } = useProfile();

  // If no profile or guest user, show access denied
  if (!effectiveProfile || effectiveProfile.role === "guest") {
    return <AccessDeniedCard role="guest" pathname={pathname} />;
  }

  // Check if user has access to the current route
  if (!hasRouteAccess(pathname, effectiveProfile.role)) {
    return (
      <AccessDeniedCard role={effectiveProfile.role} pathname={pathname} />
    );
  }

  // User has access, render children
  return <>{children}</>;
}

interface AccessDeniedCardProps {
  role: string;
  pathname: string;
}

function AccessDeniedCard({ role, pathname }: AccessDeniedCardProps) {
  const router = useRouter();
  const redirectPath = getRedirectPathForRole(
    role as "guest" | "ta" | "instructional" | "admin" | "superadmin"
  );

  const handleRedirect = () => {
    router.push(redirectPath);
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "guest":
        return "Guest User";
      case "ta":
        return "Teaching Assistant";
      case "instructional":
        return "Instructional Staff";
      case "admin":
        return "Administrator";
      case "superadmin":
        return "Super Administrator";
      default:
        return "User";
    }
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
            <div className="text-sm text-muted-foreground">
              <p>
                Current role:{" "}
                <span className="font-medium">{getRoleDisplayName(role)}</span>
              </p>
              <p>
                Attempted to access:{" "}
                <span className="font-mono text-xs">{pathname}</span>
              </p>
            </div>

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
