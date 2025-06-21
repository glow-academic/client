/**
 * ToolCall.tsx
 * Component for displaying assistant tool calls with status and results
 * @AshokSaravanan222 & @siladiea
 * 06/21/2025
 */
"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ToolCallData, ToolCallResult } from "@/contexts/chat-context";
import {
  Calculator,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Database,
  FileText,
  Globe,
  Loader2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";

interface ToolCallProps {
  toolCall: ToolCallData;
  toolResult?: ToolCallResult;
}

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case "web_search":
      return <Globe className="h-4 w-4" />;
    case "create_file":
      return <FileText className="h-4 w-4" />;
    case "database_query":
      return <Database className="h-4 w-4" />;
    case "calculator":
      return <Calculator className="h-4 w-4" />;
    default:
      return <Wrench className="h-4 w-4" />;
  }
};

const getStatusIcon = (status?: string) => {
  switch (status) {
    case "executing":
      return <Loader2 className="h-4 w-4 animate-spin" />;
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Loader2 className="h-4 w-4 animate-spin" />;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case "executing":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-green-100 text-green-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const formatToolName = (name: string) => {
  return name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const renderToolResult = (toolResult: ToolCallResult) => {
  if (toolResult.status === "error") {
    return (
      <div className="text-red-600 text-sm">
        <strong>Error:</strong> {toolResult.error}
      </div>
    );
  }

  if (!toolResult.result) {
    return <div className="text-gray-500 text-sm">No result data</div>;
  }

  const result = toolResult.result as Record<string, unknown>;

  switch (toolResult.name) {
    case "web_search":
      const searchResult = result as {
        results: Array<{ title: string; url: string; snippet: string }>;
        total_results: number;
      };
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Found {searchResult.total_results} results:
          </div>
          {searchResult.results?.map((item, index) => (
            <div key={index} className="border-l-2 border-blue-200 pl-3 py-1">
              <div className="font-medium text-sm">{item.title}</div>
              <div className="text-xs text-gray-600">{item.snippet}</div>
              <div className="text-xs text-blue-600">{item.url}</div>
            </div>
          ))}
        </div>
      );

    case "create_file":
      const fileResult = result as {
        filename: string;
        size: number;
        path: string;
      };
      return (
        <div className="space-y-1">
          <div className="text-sm">
            <strong>File:</strong> {fileResult.filename}
          </div>
          <div className="text-sm">
            <strong>Size:</strong> {fileResult.size} bytes
          </div>
          <div className="text-sm">
            <strong>Path:</strong> {fileResult.path}
          </div>
        </div>
      );

    case "database_query":
      const dbResult = result as {
        rows: Array<Record<string, unknown>>;
        count: number;
        query_time: string;
      };
      return (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Query returned {dbResult.count} rows in {dbResult.query_time}
          </div>
          {dbResult.rows?.slice(0, 3).map((row, index) => (
            <div key={index} className="text-xs bg-gray-50 p-2 rounded">
              {Object.entries(row).map(([key, value]) => (
                <div key={key}>
                  <strong>{key}:</strong> {String(value)}
                </div>
              ))}
            </div>
          ))}
          {dbResult.rows && dbResult.rows.length > 3 && (
            <div className="text-xs text-gray-500">
              ... and {dbResult.rows.length - 3} more rows
            </div>
          )}
        </div>
      );

    case "calculator":
      const calcResult = result as {
        expression: string;
        result: number;
        steps: string[];
      };
      return (
        <div className="space-y-1">
          <div className="text-sm">
            <strong>Expression:</strong> {calcResult.expression}
          </div>
          <div className="text-sm">
            <strong>Result:</strong> {calcResult.result}
          </div>
          <div className="text-xs text-gray-600">
            <strong>Steps:</strong> {calcResult.steps?.join(" → ")}
          </div>
        </div>
      );

    default:
      return (
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      );
  }
};

export default function ToolCall({ toolCall, toolResult }: ToolCallProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="mb-2 border-l-4 border-l-blue-500">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getToolIcon(toolCall.name)}
                <CardTitle className="text-sm font-medium">
                  {formatToolName(toolCall.name)}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={getStatusColor(toolCall.status)}
                >
                  <div className="flex items-center gap-1">
                    {getStatusIcon(toolCall.status)}
                    <span className="text-xs">
                      {toolCall.status || "pending"}
                    </span>
                  </div>
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {toolCall.type}
                </Badge>
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {/* Tool Arguments */}
              <div>
                <div className="text-xs font-medium text-gray-600 mb-1">
                  Arguments:
                </div>
                <div className="text-xs bg-gray-50 p-2 rounded">
                  {Object.entries(toolCall.arguments).map(([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong>{" "}
                      {typeof value === "object"
                        ? JSON.stringify(value)
                        : String(value)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tool Result */}
              {toolResult && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    Result:
                  </div>
                  <div className="text-xs">{renderToolResult(toolResult)}</div>
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
