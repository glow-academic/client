"use client";
import Markdown from "@/components/common/chat/markdown/Markdown";
import CodeViewer from "@/components/common/chat/viewers/CodeViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isCodeByName } from "@/utils/mime-map";

type DocumentItem = {
  document_id: string;
  name: string;
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

// Simplified document icon info (generic since we no longer have document types)
const getDocumentIconInfo = () => {
  return { icon: "📄", color: "bg-gray-500" };
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
  const [iframeLoading, setIframeLoading] = useState(true);

  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        setIframeLoading(true);

        // Build URL with preview parameter for compact mode
        let url = "";
        if (isFormDocument && document.upload_id) {
          // For form documents, use upload_id
          url = `/api/uploads/download/${document.upload_id}`;
        } else if (document.upload_id) {
          // Use upload_id for download
          url = `/api/uploads/download/${document.upload_id}`;
        } else {
          throw new Error("Document upload_id is required");
        }

        // Add preview parameter for compact mode (backend will only generate previews for PDFs)
        if (compact) {
          url += "?preview=true";
        }

        const response = await fetch(url, {
          method: "GET",
          credentials: "include",
        });

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
  }, [
    document.document_id,
    document.name,
    document.upload_id,
    isFormDocument,
    compact,
  ]);

  const typeInfo = getDocumentIconInfo();

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

    // PDF preview image (when compact mode returns PNG preview)
    if (
      compact &&
      type?.includes("image/png") &&
      document.name?.toLowerCase().endsWith(".pdf")
    ) {
      return (
        <div className="w-full h-full">
          <Image
            src={content ?? ""}
            alt={document.name ?? ""}
            className="w-full h-full object-contain"
            width={0}
            height={0}
            sizes="100vw"
            unoptimized
          />
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

    // HTML viewer - show rendered HTML only (no tabs), similar to TemplatePreview
    if (type?.includes("text/html") || document.name?.endsWith(".html")) {
      // Sanitize HTML content for security
      const sanitizeHtml = (html: string): string => {
        return html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
          .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
          .replace(/on\w+\s*=/gi, "data-removed=")
          .replace(/javascript:/gi, "data-removed:")
          .replace(/vbscript:/gi, "data-removed:");
      };
      const safeHtml = content ? sanitizeHtml(content) : "";

      if (compact) {
        // Compact mode: show simplified HTML preview (scaled down)
        // Use pointer-events-none to allow clicks to pass through to parent button
        return (
          <div className="w-full h-full relative overflow-hidden pointer-events-none">
            <iframe
              sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
              className="w-full h-full border-0 rounded-md pointer-events-none"
              srcDoc={safeHtml}
              title={document.name ?? ""}
              style={{
                transform: "scale(0.25)",
                transformOrigin: "top left",
                width: "400%",
                height: "400%",
                pointerEvents: "none",
              }}
            />
          </div>
        );
      }

      // Non-compact: show rendered HTML only (no tabs), like TemplatePreview
      return (
        <div className="w-full h-full relative min-h-[500px]">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <iframe
            sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
            className="w-full h-full border-0 rounded-md"
            srcDoc={safeHtml}
            title={document.name ?? ""}
            onLoad={() => setIframeLoading(false)}
            style={{
              minWidth: "800px",
              minHeight: "500px",
              ...(iframeLoading
                ? { visibility: "hidden" }
                : { visibility: "visible" }),
            }}
          />
        </div>
      );
    }

    // For compact view, show all text-based files as simple text/markdown
    if (
      compact &&
      (type?.startsWith("text/") ||
        isCodeByName(document.name) ||
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
