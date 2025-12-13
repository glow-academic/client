/**
 * UnifiedAccessDenied.tsx
 * Unified component for displaying all access denied states
 * Server component - uses Next.js Link for navigation
 * Handles: not logged in, route denied, department denied
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRedirectPathForRole, type ProfileRole } from "@/utils/route-permissions";
import { AlertTriangle, Home, Shield, ShieldX, User, UserX } from "lucide-react";
import Link from "next/link";

type AccessDeniedReason = "not-logged-in" | "route-denied" | "department";

interface UnifiedAccessDeniedProps {
  reason: AccessDeniedReason;
  pathname?: string;
  role?: ProfileRole;
  redirectPath?: string;
  resourceType?:
    | "scenario"
    | "simulation"
    | "cohort"
    | "persona"
    | "document"
    | "provider"
    | "department"
    | "agent"
    | "rubric"
    | "parameter"
    | "key"
    | "prompt"
    | "video";
}

export function UnifiedAccessDenied({
  reason,
  pathname = "/",
  role,
  redirectPath,
  resourceType,
}: UnifiedAccessDeniedProps) {
  // Handle not logged in state
  if (reason === "not-logged-in") {
    return (
      <div className="container mx-auto p-4" data-access-denied="true">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <UserX className="h-8 w-8 text-muted-foreground" />
              </div>
              <CardTitle className="text-xl">Access Denied</CardTitle>
              <CardDescription>
                You need to log in to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link
                    href={`/login?redirectPath=${encodeURIComponent(
                      redirectPath || pathname
                    )}`}
                  >
                    Log In
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle department access denied state
  if (reason === "department" && resourceType) {
    const getResourceName = () => {
      switch (resourceType) {
        case "scenario":
          return "scenario";
        case "simulation":
          return "simulation";
        case "cohort":
          return "cohort";
        case "persona":
          return "persona";
        case "department":
          return "department";
        case "agent":
          return "agent";
        case "rubric":
          return "rubric";
        case "parameter":
          return "parameter";
        case "key":
          return "key";
        case "prompt":
          return "prompt";
        case "video":
          return "video";
        default:
          return "resource";
      }
    };

    const getListPath = () => {
      switch (resourceType) {
        case "scenario":
          return "/create/scenarios";
        case "simulation":
          return "/create/simulations";
        case "cohort":
          return "/cohorts";
        case "persona":
          return "/create/personas";
        case "department":
          return "/departments";
        case "agent":
          return "/engine/agents";
        case "rubric":
          return "/engine/rubrics";
        case "parameter":
          return "/management/parameters";
        case "key":
          return "/system/keys";
        case "prompt":
          return "/engine/prompts";
        case "video":
          return "/create/videos";
        default:
          return "/";
      }
    };

    const resourceNameCapitalized =
      getResourceName().charAt(0).toUpperCase() + getResourceName().slice(1);

    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <ShieldX className="h-8 w-8 text-orange-500" />
              </div>
              <CardTitle className="text-xl">Access Restricted</CardTitle>
              <CardDescription>
                This {getResourceName()} is restricted to other departments. You
                don't have permission to access it.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link href={redirectPath || getListPath()}>
                    Go to {resourceNameCapitalized}s List
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={getListPath()}>
                    View All {resourceNameCapitalized}s
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Handle route denied state (role-based access)
  const getAccessDeniedMessage = (role: ProfileRole | undefined, pathname: string) => {
    const section = pathname.split("/")[1];

    switch (role) {
      case "guest":
        return "You need to log in to access this page.";
      case "member":
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

  const getIcon = (role: ProfileRole | undefined) => {
    switch (role) {
      case "guest":
        return <User className="h-8 w-8 text-muted-foreground" />;
      case "member":
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

  const finalRedirectPath =
    redirectPath || (role ? getRedirectPathForRole(role) : "/");

  return (
    <div className="container mx-auto p-4" data-access-denied="true">
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
              <Button asChild className="w-full">
                <Link href={finalRedirectPath}>
                  <Home className="h-4 w-4 mr-2 inline" />
                  Go to Dashboard
                </Link>
              </Button>

              {role === "guest" && (
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login">Log In</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

