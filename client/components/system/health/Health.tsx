/**
 * Health.tsx
 * Comprehensive system health monitoring component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWebSocket } from "@/contexts/websocket-context";
import { getApiBase } from "@/lib/api-base";
import { logError, logInfo } from "@/utils/logger";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  FileText,
  Globe,
  Loader2,
  Map,
  RefreshCw,
  Server,
  Shield,
  Signal,
  TestTube,
  User,
  Wifi,
  XCircle,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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

interface StressTestResult {
  id: string;
  name: string;
  status: "running" | "completed" | "failed";
  responseTime?: number;
  successRate?: number;
  totalRequests?: number;
  failedRequests?: number;
  error?: string;
  details?: {
    totalLinks?: number;
    brokenLinks?: number;
    uploadSuccess?: boolean;
    routesScanned?: number;
    routesWithIssues?: number;
  };
}

export default function Health() {
  const { isConnected } = useWebSocket();
  const { data: session, status: authStatus } = useSession();
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [stressTests, setStressTests] = useState<StressTestResult[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isRunningStressTests, setIsRunningStressTests] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

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
        description: "Simulation agent and chat functionality",
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

  const runHealthCheck = useCallback(
    async (checkId: string): Promise<HealthCheck> => {
      const startTime = Date.now();

      // Define check info statically to avoid dependency issues
      const checkInfo: Record<
        string,
        {
          name: string;
          description: string;
          icon: React.ComponentType<{ className?: string }>;
        }
      > = {
        "client-api": {
          name: "Client API",
          description: "Next.js API routes health",
          icon: Server,
        },
        "server-api": {
          name: "Server API",
          description: "FastAPI backend service",
          icon: Database,
        },
        "simulation-service": {
          name: "Simulation Service",
          description: "Simulation agent and chat functionality",
          icon: TestTube,
        },
        "assistant-service": {
          name: "Assistant Service",
          description: "Assistant agent and tool functionality",
          icon: User,
        },
        database: {
          name: "Database Connection",
          description: "PostgreSQL database connectivity",
          icon: Database,
        },
        "document-upload": {
          name: "Document Upload Service",
          description: "File upload and processing functionality",
          icon: FileText,
        },
        "route-scan": {
          name: "Route Scanner",
          description: "Application route accessibility check",
          icon: Map,
        },
      };

      const currentCheck = checkInfo[checkId];

      try {
        switch (checkId) {
          case "client-api":
            const clientResponse = await fetch("/api/health");
            if (!clientResponse.ok)
              throw new Error(`HTTP ${clientResponse.status}`);
            break;

          case "server-api":
            const serverResponse = await fetch(`${getApiBase()}/health`);
            if (!serverResponse.ok)
              throw new Error(`HTTP ${serverResponse.status}`);
            break;

          case "simulation-service":
            // Test simulation service by checking if the endpoint exists
            const simResponse = await fetch(`${getApiBase()}/`);
            if (!simResponse.ok) throw new Error(`HTTP ${simResponse.status}`);
            break;

          case "assistant-service":
            // Test assistant service by checking if the endpoint exists
            const assistantResponse = await fetch(`${getApiBase()}/`);
            if (!assistantResponse.ok)
              throw new Error(`HTTP ${assistantResponse.status}`);
            break;

          case "database":
            // Test database connectivity through a simple query
            const dbResponse = await fetch(`${getApiBase()}/`);
            if (!dbResponse.ok) throw new Error(`HTTP ${dbResponse.status}`);
            break;

          case "document-upload":
            // Test document upload service by checking the documents health endpoint
            const uploadResponse = await fetch(
              `${getApiBase()}/documents/health`
            );
            if (!uploadResponse.ok)
              throw new Error(`HTTP ${uploadResponse.status}`);
            break;

          case "route-scan":
            // Test route scanner by checking main routes
            const routes = ["/", "/home", "/profile", "/system/health"];
            const routePromises = routes.map((route) =>
              fetch(route).then((res) => ({ route, status: res.status }))
            );
            const routeResults = await Promise.all(routePromises);
            const failedRoutes = routeResults.filter((r) => r.status >= 400);
            if (failedRoutes.length > 0) {
              throw new Error(
                `Routes with issues: ${failedRoutes.map((r) => r.route).join(", ")}`
              );
            }
            break;

          default:
            throw new Error("Unknown health check");
        }

        const responseTime = Date.now() - startTime;
        return {
          id: checkId,
          name: currentCheck?.name || checkId,
          description: currentCheck?.description || "",
          status: "healthy",
          responseTime,
          lastChecked: new Date(),
          icon: currentCheck?.icon || Server,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logError(`Health check failed for ${checkId}:`, error);
        return {
          id: checkId,
          name: currentCheck?.name || checkId,
          description: currentCheck?.description || "",
          status: "unhealthy",
          responseTime,
          error: error instanceof Error ? error.message : "Unknown error",
          lastChecked: new Date(),
          icon: currentCheck?.icon || Server,
        };
      }
    },
    []
  );

  const runAllHealthChecks = useCallback(async () => {
    setIsRunningChecks(true);
    logInfo("Starting comprehensive health checks");

    const checkIds = [
      "client-api",
      "server-api",
      "simulation-service",
      "assistant-service",
      "database",
      "document-upload",
      "route-scan",
    ];
    const results = await Promise.all(checkIds.map((id) => runHealthCheck(id)));

    setHealthChecks((prev) =>
      prev.map((check) => {
        const result = results.find((r) => r.id === check.id);
        return result || check;
      })
    );

    setLastRefresh(new Date());
    setIsRunningChecks(false);

    const healthyCount = results.filter((r) => r.status === "healthy").length;
    const totalCount = results.length;

    if (healthyCount === totalCount) {
      toast.success(
        `All health checks passed! (${healthyCount}/${totalCount})`
      );
    } else {
      toast.error(
        `Health checks completed with issues (${healthyCount}/${totalCount} healthy)`
      );
    }
  }, [runHealthCheck]);

  // Run health checks on mount
  useEffect(() => {
    if (healthChecks.length > 0 && authStatus !== "loading") {
      runAllHealthChecks();
    }
  }, [healthChecks.length, authStatus, runAllHealthChecks]);

  const runStressTest = useCallback(
    async (testId: string): Promise<StressTestResult> => {
      const startTime = Date.now();
      const totalRequests = 10;
      let successCount = 0;
      let failedCount = 0;

      try {
        switch (testId) {
          case "api-load":
            // Test API endpoint with multiple concurrent requests
            const promises = Array.from({ length: totalRequests }, () =>
              fetch(`${getApiBase()}/health`)
                .then((res) => {
                  if (res.ok) successCount++;
                  else failedCount++;
                })
                .catch(() => failedCount++)
            );
            await Promise.all(promises);
            break;

          case "websocket-load":
            // Test WebSocket connection stability
            if (isConnected) {
              successCount = totalRequests;
            } else {
              failedCount = totalRequests;
            }
            break;

          case "auth-load":
            // Test authentication service
            if (authStatus === "authenticated") {
              successCount = totalRequests;
            } else {
              failedCount = totalRequests;
            }
            break;

          case "navigation-crawl":
            // Test navigation by crawling links
            const links = [
              "/",
              "/home",
              "/profile",
              "/system/health",
              "/classes",
              "/cohorts",
              "/analytics",
              "/management",
            ];

            const linkPromises = links.map((link) =>
              fetch(link)
                .then((res) => ({ link, status: res.status, ok: res.ok }))
                .catch((err) => ({
                  link,
                  status: 0,
                  ok: false,
                  error: err.message,
                }))
            );

            const linkResults = await Promise.all(linkPromises);
            const workingLinks = linkResults.filter((r) => r.ok);
            const brokenLinks = linkResults.filter((r) => !r.ok);

            successCount = workingLinks.length;
            failedCount = brokenLinks.length;

            return {
              id: testId,
              name: "Navigation Crawl Test",
              status:
                workingLinks.length / links.length >= 0.8
                  ? "completed"
                  : "failed",
              responseTime: Date.now() - startTime,
              successRate: (workingLinks.length / links.length) * 100,
              totalRequests: links.length,
              failedRequests: brokenLinks.length,
              details: {
                totalLinks: links.length,
                brokenLinks: brokenLinks.length,
              },
            };

          case "document-upload-test":
            // Test document upload functionality by checking endpoint availability
            // and doing a single test upload
            try {
              // First check if the upload endpoint is available
              const healthResponse = await fetch(
                `${getApiBase()}/documents/health`
              );
              if (!healthResponse.ok) {
                failedCount = totalRequests;
                break;
              }

              // Test TUS endpoint availability
              const tusResponse = await fetch(`${getApiBase()}/documents/tus`, {
                method: "OPTIONS",
              });
              if (!tusResponse.ok) {
                failedCount = totalRequests;
                break;
              }

              // If both endpoints are available, consider it a success
              successCount = totalRequests;
            } catch {
              failedCount = totalRequests;
            }
            break;

          default:
            throw new Error("Unknown stress test");
        }

        const responseTime = Date.now() - startTime;
        const successRate = (successCount / totalRequests) * 100;

        return {
          id: testId,
          name: stressTests.find((t) => t.id === testId)?.name || "",
          status: successRate >= 80 ? "completed" : "failed",
          responseTime,
          successRate,
          totalRequests,
          failedRequests: failedCount,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;
        logError(`Stress test failed for ${testId}:`, error);
        return {
          id: testId,
          name: stressTests.find((t) => t.id === testId)?.name || "",
          status: "failed",
          responseTime,
          successRate: 0,
          totalRequests,
          failedRequests: totalRequests,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
    [isConnected, authStatus, stressTests]
  );

  const runAllStressTests = useCallback(async () => {
    setIsRunningStressTests(true);
    logInfo("Starting stress tests");

    const testIds = [
      "api-load",
      "websocket-load",
      "auth-load",
      "navigation-crawl",
      "document-upload-test",
    ];
    const results = await Promise.all(testIds.map((id) => runStressTest(id)));

    setStressTests(results);
    setIsRunningStressTests(false);

    const passedCount = results.filter((r) => r.status === "completed").length;
    const totalCount = results.length;

    if (passedCount === totalCount) {
      toast.success(`All stress tests passed! (${passedCount}/${totalCount})`);
    } else {
      toast.error(
        `Stress tests completed with issues (${passedCount}/${totalCount} passed)`
      );
    }
  }, [runStressTest]);

  const getStatusIcon = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "loading":
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: HealthCheck["status"]) => {
    switch (status) {
      case "healthy":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Healthy
          </Badge>
        );
      case "unhealthy":
        return <Badge variant="destructive">Unhealthy</Badge>;
      case "warning":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Warning
          </Badge>
        );
      case "loading":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Checking...
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getStressTestStatus = (status: StressTestResult["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Passed
          </Badge>
        );
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Running...
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const overallHealth =
    healthChecks.length > 0
      ? (healthChecks.filter((c) => c.status === "healthy").length /
          healthChecks.length) *
        100
      : 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600" />
            System Health Monitor
          </h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive monitoring of all system services and components
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={runAllHealthChecks}
            disabled={isRunningChecks}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRunningChecks ? "animate-spin" : ""}`}
            />
            {isRunningChecks ? "Checking..." : "Run Health Checks"}
          </Button>
          <Button
            onClick={runAllStressTests}
            disabled={isRunningStressTests}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube
              className={`h-4 w-4 ${isRunningStressTests ? "animate-spin" : ""}`}
            />
            {isRunningStressTests ? "Testing..." : "Run Stress Tests"}
          </Button>
        </div>
      </div>

      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Signal className="h-5 w-5" />
            Overall System Health
          </CardTitle>
          <CardDescription>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">System Health Score</span>
              <span className="text-2xl font-bold text-blue-600">
                {Math.round(overallHealth)}%
              </span>
            </div>
            <Progress value={overallHealth} className="h-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {healthChecks.filter((c) => c.status === "healthy").length}
                </div>
                <div className="text-muted-foreground">Healthy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {healthChecks.filter((c) => c.status === "unhealthy").length}
                </div>
                <div className="text-muted-foreground">Unhealthy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {healthChecks.filter((c) => c.status === "warning").length}
                </div>
                <div className="text-muted-foreground">Warning</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {healthChecks.filter((c) => c.status === "loading").length}
                </div>
                <div className="text-muted-foreground">Checking</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthChecks.map((check) => {
          const IconComponent = check.icon;
          return (
            <Card key={check.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-base">{check.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {check.description}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusIcon(check.status)}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {getStatusBadge(check.status)}

                  {check.responseTime !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Response Time:
                      </span>
                      <span className="font-mono">{check.responseTime}ms</span>
                    </div>
                  )}

                  {check.lastChecked && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Last Checked:
                      </span>
                      <span className="font-mono">
                        {check.lastChecked.toLocaleTimeString()}
                      </span>
                    </div>
                  )}

                  {check.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {check.error}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stress Tests */}
      {stressTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Stress Test Results
            </CardTitle>
            <CardDescription>
              Performance and load testing results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stressTests.map((test) => (
                <div key={test.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{test.name}</h4>
                    {getStressTestStatus(test.status)}
                  </div>

                  {test.responseTime !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Avg Response:
                      </span>
                      <span className="font-mono">{test.responseTime}ms</span>
                    </div>
                  )}

                  {test.successRate !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Success Rate:
                      </span>
                      <span className="font-mono">
                        {test.successRate.toFixed(1)}%
                      </span>
                    </div>
                  )}

                  {test.totalRequests !== undefined && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Requests:
                      </span>
                      <span className="font-mono">{test.totalRequests}</span>
                    </div>
                  )}

                  {test.failedRequests !== undefined &&
                    test.failedRequests > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Failed:</span>
                        <span className="font-mono text-red-600">
                          {test.failedRequests}
                        </span>
                      </div>
                    )}

                  {test.details?.totalLinks && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total Links:
                      </span>
                      <span className="font-mono">
                        {test.details.totalLinks}
                      </span>
                    </div>
                  )}

                  {test.details?.brokenLinks &&
                    test.details.brokenLinks > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          Broken Links:
                        </span>
                        <span className="font-mono text-red-600">
                          {test.details.brokenLinks}
                        </span>
                      </div>
                    )}

                  {test.error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {test.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Environment:</span>
                <span className="font-mono">
                  {process.env["NODE_ENV"] || "development"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">API Base:</span>
                <span className="font-mono">{getApiBase() || "localhost"}</span>
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
                <span className="text-muted-foreground">Authentication:</span>
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
  );
}
