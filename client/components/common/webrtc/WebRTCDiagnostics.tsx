"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { logInfo } from "@/utils/logger";
import {
  diagnoseWebRTCIssues,
  testWebRTCConnectivity,
  WebRTCConnectionStats,
  webRTCDebugger,
} from "@/utils/webrtc-debug";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  RefreshCw,
  Wifi,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface WebRTCDiagnosticsProps {
  connectionId?: string;
  profileId?: string;
  className?: string;
}

export default function WebRTCDiagnostics({
  connectionId,
  profileId,
  className = "",
}: WebRTCDiagnosticsProps) {
  const [stats, setStats] = useState<WebRTCConnectionStats | null>(null);
  const [diagnosis, setDiagnosis] = useState<{
    diagnosis: string;
    severity: "low" | "medium" | "high";
    recommendations: string[];
  } | null>(null);
  const [connectivityTest, setConnectivityTest] = useState<{
    success: boolean;
    results: {
      iceServers: boolean;
      stunConnectivity: boolean;
      turnConnectivity: boolean;
      dataChannels: boolean;
    };
    errors: string[];
  } | null>(null);
  const [isTestingConnectivity, setIsTestingConnectivity] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const activeConnectionId = connectionId || profileId;

  // Update stats periodically
  useEffect(() => {
    if (!activeConnectionId) return;

    const updateStats = () => {
      const currentStats = webRTCDebugger.getStats(activeConnectionId);
      if (currentStats) {
        setStats(currentStats);
        const currentDiagnosis = diagnoseWebRTCIssues(activeConnectionId);
        setDiagnosis(currentDiagnosis);
      }
    };

    // Initial update
    updateStats();

    // Set up periodic updates
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, [activeConnectionId]);

  const runConnectivityTest = async () => {
    setIsTestingConnectivity(true);
    try {
      const testResult = await testWebRTCConnectivity();
      setConnectivityTest(testResult);
      logInfo("WebRTC connectivity test completed", testResult);
    } catch (error) {
      logInfo("WebRTC connectivity test failed", { error: String(error) });
      setConnectivityTest({
        success: false,
        results: {
          iceServers: false,
          stunConnectivity: false,
          turnConnectivity: false,
          dataChannels: false,
        },
        errors: [`Test failed: ${error}`],
      });
    } finally {
      setIsTestingConnectivity(false);
    }
  };

  const getSeverityColor = (severity: "low" | "medium" | "high"): string => {
    switch (severity) {
      case "low":
        return "text-green-600 bg-green-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "high":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getSeverityIcon = (severity: "low" | "medium" | "high") => {
    switch (severity) {
      case "low":
        return <CheckCircle className="h-4 w-4" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4" />;
      case "high":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getConnectionStateColor = (state: RTCPeerConnectionState): string => {
    switch (state) {
      case "connected":
        return "text-green-600 bg-green-100";
      case "connecting":
        return "text-blue-600 bg-blue-100";
      case "disconnected":
        return "text-yellow-600 bg-yellow-100";
      case "failed":
        return "text-red-600 bg-red-100";
      case "closed":
        return "text-gray-600 bg-gray-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  if (!activeConnectionId) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="text-center text-gray-500">
            <Wifi className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No WebRTC connection to monitor</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" />
          WebRTC Diagnostics
          {stats && (
            <Badge
              variant="outline"
              className={getConnectionStateColor(stats.connectionState)}
            >
              {stats.connectionState}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Health Status */}
        {diagnosis && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {getSeverityIcon(diagnosis.severity)}
              <span className="text-sm font-medium">Health Status</span>
              <Badge
                variant="outline"
                className={getSeverityColor(diagnosis.severity)}
              >
                {diagnosis.severity}
              </Badge>
            </div>
            <p className="text-sm text-gray-600">{diagnosis.diagnosis}</p>
          </div>
        )}

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">ICE State:</span>
              <Badge variant="outline" className="ml-2">
                {stats.iceConnectionState}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Data Channels:</span>
              <Badge variant="outline" className="ml-2">
                {stats.dataChannelsOpen}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Candidates Sent:</span>
              <Badge variant="outline" className="ml-2">
                {stats.iceCandidatesSent}
              </Badge>
            </div>
            <div>
              <span className="text-gray-500">Candidates Received:</span>
              <Badge variant="outline" className="ml-2">
                {stats.iceCandidatesReceived}
              </Badge>
            </div>
          </div>
        )}

        {/* Troubleshooting Recommendations */}
        {diagnosis && diagnosis.recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Recommendations:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {diagnosis.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  {recommendation}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Connectivity Test */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connectivity Test</span>
            <Button
              variant="outline"
              size="sm"
              onClick={runConnectivityTest}
              disabled={isTestingConnectivity}
            >
              {isTestingConnectivity ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                "Test"
              )}
            </Button>
          </div>

          {connectivityTest && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  {connectivityTest.results.iceServers ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  ICE Servers
                </div>
                <div className="flex items-center gap-1">
                  {connectivityTest.results.dataChannels ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-500" />
                  )}
                  Data Channels
                </div>
              </div>

              {connectivityTest.errors.length > 0 && (
                <div className="text-xs text-red-600">
                  <strong>Errors:</strong>
                  <ul className="mt-1 space-y-1">
                    {connectivityTest.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detailed Debug Info (Collapsible) */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between"
            >
              <span className="text-sm">Debug Details</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {stats && (
              <div className="text-xs space-y-2 bg-gray-50 p-3 rounded">
                <div>
                  <strong>Connection ID:</strong> {activeConnectionId}
                </div>
                <div>
                  <strong>Signaling State:</strong> {stats.signalingState}
                </div>
                <div>
                  <strong>ICE Gathering State:</strong>{" "}
                  {stats.iceGatheringState}
                </div>
                <div>
                  <strong>Last State Change:</strong>{" "}
                  {stats.lastStateChange.toLocaleString()}
                </div>

                {stats.errors.length > 0 && (
                  <div>
                    <strong>Recent Errors:</strong>
                    <ul className="mt-1 space-y-1">
                      {stats.errors.map((error, index) => (
                        <li key={index} className="text-red-600">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const report =
                  webRTCDebugger.generateDebugReport(activeConnectionId);
                logInfo("Debug report", { report });
                navigator.clipboard?.writeText(report).then(() => {
                  logInfo("Debug report copied to clipboard");
                });
              }}
            >
              Copy Debug Report
            </Button>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
