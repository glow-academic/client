/**
 * AccessDenied.tsx
 * Shared component for displaying authentication access denied messages
 * Server component - uses Next.js Link for navigation
 */
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserX } from "lucide-react";
import Link from "next/link";

interface AccessDeniedProps {
  message?: string;
  redirectPath?: string;
  showLoginButton?: boolean;
}

export function AccessDenied({
  message = "You need to log in to access this page.",
  redirectPath = "/",
  showLoginButton = true,
}: AccessDeniedProps) {
  return (
    <div className="container mx-auto p-4" data-access-denied="true">
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <UserX className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex flex-col gap-2">
              {showLoginButton && (
                <Button asChild className="w-full">
                  <Link
                    href={`/login?redirectPath=${encodeURIComponent(redirectPath)}`}
                  >
                    Log In
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
