/**
 * TemplatePreview.tsx
 * Preview component for Jinja templates with live refresh
 */

"use client";
import CodeViewer from "@/components/common/chat/viewers/CodeViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

export interface TemplatePreviewProps {
  documentId: string | null;
  templateHtml: string | null;
  renderedHtml?: string | null;
}

export default function TemplatePreview({
  documentId,
  templateHtml,
  renderedHtml = null,
}: TemplatePreviewProps) {
  const [iframeLoading, setIframeLoading] = useState(true);

  // Sanitize HTML content for security
  const sanitizeHtml = (html: string): string => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=/gi, "data-removed=")
      .replace(/javascript:/gi, "data-removed:")
      .replace(/vbscript:/gi, "data-removed:");
  };

  if (!templateHtml) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        Generate a template to see preview
      </div>
    );
  }

  // For new page (no documentId), show template source only
  if (!documentId) {
    return (
      <Tabs defaultValue="source" className="w-full h-full">
        <TabsList className="grid w-full grid-cols-1">
          <TabsTrigger value="source">Template Source</TabsTrigger>
        </TabsList>
        <TabsContent value="source" className="mt-4 h-full">
          <div className="text-sm text-muted-foreground mb-2">
            Create the document to see rendered preview with theme colors
          </div>
          <CodeViewer name="Template HTML" value={templateHtml} />
        </TabsContent>
      </Tabs>
    );
  }

  // When documentId exists, show only rendered HTML (no tabs)
  const safeHtml = renderedHtml ? sanitizeHtml(renderedHtml) : null;

  if (safeHtml) {
    return (
      <div className="w-full h-full relative">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <iframe
          sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
          className="w-full h-full border-0"
          srcDoc={safeHtml}
          title="Template Preview"
          onLoad={() => setIframeLoading(false)}
          style={
            iframeLoading ? { visibility: "hidden" } : { visibility: "visible" }
          }
        />
      </div>
    );
  }

  // Fallback message
  return (
    <div className="text-sm text-muted-foreground p-4">
      Fill in template arguments to see preview
    </div>
  );
}
