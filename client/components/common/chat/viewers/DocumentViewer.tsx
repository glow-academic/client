"use client";
import Markdown from "@/components/common/chat/markdown/Markdown";
import CodeViewer from "@/components/common/chat/viewers/CodeViewer";
import HtmlViewer from "@/components/common/chat/viewers/HtmlViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isCodeByName } from "@/utils/mime-map";

type DocumentItem = {
  document_id: string;
  name: string;
  type: string;
  updatedAt: string;
  extension: string;
  scenario_ids: string[];
  can_edit: boolean;
  can_delete: boolean;
  active: boolean;
  department_ids: string[] | null;
  upload_id: string | null;
  parameter_item_ids: string[];
};

import { Download, FileText } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export interface DocumentViewerProps {
  document: DocumentItem;
  bare?: boolean;
  isFormDocument?: boolean;
  compact?: boolean;
}

// Detect iOS Safari (native PDF viewer has scroll issues in iframes)
const isMobileSafari =
  typeof navigator !== "undefined" &&
  /iP(ad|hone|od)/.test(navigator.userAgent) &&
  /Safari/.test(navigator.userAgent) &&
  !/CriOS|FxiOS/.test(navigator.userAgent);

// Simplified document type info
const getDocumentTypeInfo = (type: string) => {
  const typeMap: Record<string, { icon: string; color: string }> = {
    homework: { icon: "📝", color: "bg-blue-500" },
    project: { icon: "🚀", color: "bg-purple-500" },
    quiz: { icon: "❓", color: "bg-yellow-500" },
    midterm: { icon: "📊", color: "bg-red-500" },
    lab: { icon: "🧪", color: "bg-green-500" },
  };
  return typeMap[type] || { icon: "📄", color: "bg-gray-500" };
};

export default function DocumentViewer({
  document,
  bare = true,
  isFormDocument = false,
  compact = false,
}: DocumentViewerProps) {
  const [content, setContent] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);

        // Call the API route directly or use blob URL for form documents
        let response;
        if (isFormDocument && document.upload_id) {
          // For form documents, use upload_id
          response = await fetch(
            `/api/uploads/download/${document.upload_id}`,
            {
              method: "GET",
              credentials: "include",
            }
          );
        } else if (document.upload_id) {
          // Use upload_id for download
          response = await fetch(
            `/api/uploads/download/${document.upload_id}`,
            {
              method: "GET",
              credentials: "include",
            }
          );
        } else {
          throw new Error("Document upload_id is required");
        }

        if (!response.ok) {
          // Try to get error details from JSON response
          let errorMessage = `Failed to load document: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.message) {
              errorMessage = errorData.message;
            }
          } catch {
            // If not JSON, use the default error message
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type") ?? "";
        setType(contentType);

        const shouldTreatAsText =
          contentType.startsWith("text/") || isCodeByName(document.name);

        // Read once
        if (shouldTreatAsText) {
          setContent(await response.text());
        } else {
          const blob = await response.blob();
          setContent(URL.createObjectURL(blob));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [document.document_id, document.file_path, document.name, isFormDocument]);

  const typeInfo = getDocumentTypeInfo(document.type || "homework");

  // Simplified content rendering
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Failed to load document
          </p>
        </div>
      );
    }

    // PDF viewer - always fit to width
    if (type?.includes("application/pdf")) {
      // iOS Safari: open natively (scroll works, no freeze)
      if (isMobileSafari) {
        return (
          <div className="p-2">
            <Button asChild variant="default" className="w-full">
              <a href={content ?? ""} target="_blank" rel="noopener noreferrer">
                Open PDF
              </a>
            </Button>
          </div>
        );
      }

      // Everyone else: keep iframe
      return (
        <div className="w-full h-full min-h-[400px]">
          <iframe
            src={`${content}#view=FitH&toolbar=1&navpanes=0&scrollbar=1`}
            title={document.name ?? ""}
            className="w-full h-full border-0 rounded-md"
            style={{
              minHeight: "500px",
              width: "100%",
              height: "100%",
            }}
          />
        </div>
      );
    }

    // Image viewer - responsive and fit to width
    if (type?.includes("image/")) {
      return (
        <div className="w-full h-full">
          <Image
            src={content ?? ""}
            alt={document.name ?? ""}
            className="w-full h-full object-cover"
            width={0}
            height={0}
            sizes="100vw"
            unoptimized
          />
        </div>
      );
    }

    // For compact view, show all text-based files as simple text/markdown
    if (
      compact &&
      (type?.startsWith("text/") ||
        isCodeByName(document.name) ||
        document.name?.endsWith(".html") ||
        document.name?.endsWith(".md"))
    ) {
      return (
        <div className="w-full h-full p-1 flex flex-col">
          {document.name?.endsWith(".md") ? (
            <div className="prose prose-xs max-w-none dark:prose-invert flex-1 min-h-0 overflow-y-auto leading-tight">
              <Markdown>{content ?? ""}</Markdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-[4px] leading-[6px] font-mono bg-muted/30 p-1 rounded-md overflow-auto flex-1 min-h-0">
              {content}
            </pre>
          )}
        </div>
      );
    }

    // Code files viewer with Monaco editor (non-compact only)
    if (
      type === "text/x-java-source" ||
      type === "text/x-java" ||
      type === "text/x-python" ||
      type === "text/x-script.python" ||
      type === "text/javascript" ||
      type === "text/typescript" ||
      type === "text/css" ||
      type === "application/json" ||
      type === "application/sql" ||
      isCodeByName(document.name)
    ) {
      return (
        <div className="w-full h-full flex flex-col">
          <CodeViewer name={document.name} value={content ?? ""} />
        </div>
      );
    }

    // HTML viewer with tabs for rendered and source (non-compact only)
    if (type?.includes("text/html") || document.name?.endsWith(".html")) {
      return (
        <div className="w-full h-full flex flex-col">
          <HtmlViewer name={document.name} content={content ?? ""} />
        </div>
      );
    }

    // Text/Markdown viewer (non-compact only)
    if (type?.includes("text/") || document.name?.endsWith(".md")) {
      return (
        <div className="w-full h-full flex flex-col">
          <CodeViewer name={document.name} value={content ?? ""} />
        </div>
      );
    }

    // Unsupported file type
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Preview not available</p>
      </div>
    );
  };

  // Render document view
  if (bare) {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {renderContent()}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant="outline"
            className={`${typeInfo.color} text-white border-none shrink-0`}
          >
            {typeInfo.icon}
          </Badge>
          <span className="text-sm font-medium truncate">{document.name}</span>
        </div>
        <Button size="sm" variant="ghost" asChild className="shrink-0">
          <a href={content ?? ""} download={document.name ?? ""}>
            <Download className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">{renderContent()}</ScrollArea>
    </div>
  );
}
