/**
 * HealthModal.tsx
 * Compact health monitoring modal for logs toolbar
 * @AshokSaravanan222 & @siladiea
 * 10/14/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWebSocket } from "@/contexts/websocket-context";
import { getApiBase } from "@/lib/api/v2/api-base";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Globe,
  Loader2,
  Map,
  Server,
  Shield,
  TestTube,
  User,
  Wifi,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type HealthCheckItem = {
  id: string;
  name: string;
  description: string;
  status: "healthy" | "unhealthy" | "warning" | "n/a";
  response_time: number | null;
  last_checked: string;
  message?: string | null;
  error?: string | null;
};

interface HealthCheck {
  id: string;
  name: string;
  description: string;
  status: "healthy" | "unhealthy" | "loading" | "warning";
  responseTime?: number | undefined;
  error?: string | undefined;
  lastChecked?: Date | undefined;
  icon: React.ComponentType<{ className?: string }>;
}

interface HealthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthModal({ open, onOpenChange }: HealthModalProps) {
  const { isConnected } = useWebSocket();
  const { data: session, status: authStatus } = useSession();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  // Initialize health checks
  useEffect(() => {
    const initialChecks: HealthCheck[] = [
      {
        id: "websocket",
        name: "WebSocket Connection",
        description: "Real-time communication service",
        status: "loading",
        icon: Wifi,
      },
      {
        id: "authentication",
        name: "Authentication Service",
        description: "User authentication and session management",
        status: "loading",
        icon: Shield,
      },
      {
        id: "client-api",
        name: "Client API",
        description: "Next.js API routes health",
        status: "loading",
        icon: Server,
      },
      {
        id: "server-api",
        name: "Server API",
        description: "FastAPI backend service",
        status: "loading",
        icon: Database,
      },
      {
        id: "simulation-service",
        name: "Simulation Service",
        description: "Simulation persona and chat functionality",
        status: "loading",
        icon: TestTube,
      },
      {
        id: "assistant-service",
        name: "Assistant Service",
        description: "Assistant agent and tool functionality",
        status: "loading",
        icon: User,
      },
      {
        id: "database",
        name: "Database Connection",
        description: "PostgreSQL database connectivity",
        status: "loading",
        icon: Database,
      },
      {
        id: "document-upload",
        name: "Document Upload Service",
        description: "File upload and processing functionality",
        status: "loading",
        icon: FileText,
      },
      {
        id: "route-scan",
        name: "Route Scanner",
        description: "Application route accessibility check",
        status: "loading",
        icon: Map,
      },
    ];

    setHealthChecks(initialChecks);
  }, []);

  // Update WebSocket status
  useEffect(() => {
    setHealthChecks((prev) =>
      prev.map((check) =>
        check.id === "websocket"
          ? {
              ...check,
              status: isConnected ? "healthy" : "unhealthy",
              lastChecked: new Date(),
              responseTime: isConnected ? 0 : undefined,
            }
          : check
      )
    );
  }, [isConnected]);

  // Update authentication status
  useEffect(() => {
    setHealthChecks((prev) =>
      prev.map((check) =>
        check.id === "authentication"
          ? {
              ...check,
              status:
                authStatus === "loading"
                  ? "loading"
                  : authStatus === "authenticated"
                    ? "healthy"
                    : authStatus === "unauthenticated"
                      ? "warning"
                      : "unhealthy",
              lastChecked: new Date(),
              responseTime: authStatus === "loading" ? undefined : 0,
            }
          : check
      )
    );
  }, [authStatus]);

  const runAllHealthChecks = useCallback(async () => {
    try {
      const response = await fetch("/api/v2/logs/health");

      if (!response.ok) {
        throw new Error(`Health endpoint returned ${response.status}`);
      }

      const healthData = await response.json();

      // Map server health checks to UI state
      setHealthChecks((prev) =>
        prev.map((check) => {
          const serverCheck = healthData.checks.find(
            (c: HealthCheckItem) => c.id === check.id
          );
          if (serverCheck) {
            return {
              ...check,
              status: serverCheck.status,
              responseTime: serverCheck.response_time ?? undefined,
              lastChecked: new Date(serverCheck.last_checked),
              error: serverCheck.error ?? undefined,
            };
          }
          return check;
        })
      );

      // Show toast with results
      const healthyCount = healthData.checks.filter(
        (c: HealthCheckItem) => c.status === "healthy"
      ).length;
      const totalCount = healthData.checks.length;

      if (healthyCount === totalCount) {
        toast.success(
          `All health checks passed! (${healthyCount}/${totalCount})`
        );
      } else {
        toast.error(
          `Health checks completed with issues (${healthyCount}/${totalCount} healthy)`
        );
      }
    } catch {
      toast.error("Failed to run health checks");
    }
  }, []);

  // Run health checks when modal opens
  useEffect(() => {
    if (open && healthChecks.length > 0 && authStatus !== "loading") {
      runAllHealthChecks();
    }
  }, [open, healthChecks.length, authStatus, runAllHealthChecks]);

  const getStatusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "unhealthy":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "loading":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return (
          <Badge
            variant="default"
            className="bg-green-100 text-green-800 text-xs"
          >
            Healthy
          </Badge>
        );
      case "unhealthy":
        return (
          <Badge variant="destructive" className="text-xs">
            Unhealthy
          </Badge>
        );
      case "warning":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 text-xs"
          >
            Warning
          </Badge>
        );
      case "loading":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 text-xs"
          >
            Checking...
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            Unknown
          </Badge>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            System Health
          </DialogTitle>
          <DialogDescription>
            Real-time monitoring of system components and services
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Health Checks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {healthChecks.map((check) => {
              const IconComponent = check.icon;
              return (
                <Card
                  key={check.id}
                  className="hover:shadow-sm transition-shadow"
                >
                  <CardHeader className="pb-2 pt-3 px-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-blue-600" />
                        <div>
                          <CardTitle className="text-sm">
                            {check.name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {check.description}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusIcon(check.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2 pb-3 px-3">
                    <div className="space-y-2">
                      {getStatusBadge(check.status)}

                      {check.responseTime !== undefined && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Response Time:
                          </span>
                          <span className="font-mono">
                            {check.responseTime}ms
                          </span>
                        </div>
                      )}

                      {check.lastChecked && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            Last Checked:
                          </span>
                          <span className="font-mono">
                            {check.lastChecked.toLocaleTimeString()}
                          </span>
                        </div>
                      )}

                      {check.error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                          {check.error}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* System Information Footer */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="h-4 w-4" />
                System Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Environment:</span>
                    <span className="font-mono">
                      {process.env["NODE_ENV"] || "development"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">API Base:</span>
                    <span className="font-mono">
                      {getApiBase() || "localhost"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">App Prefix:</span>
                    <span className="font-mono">
                      {process.env["NEXT_PUBLIC_APP_PREFIX"] || "none"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Authentication:
                    </span>
                    <span className="font-mono">{authStatus}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">WebSocket:</span>
                    <span className="font-mono">
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">User:</span>
                    <span className="font-mono">
                      {session?.user?.email || "Guest"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
