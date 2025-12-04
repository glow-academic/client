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

  const safeHtml = renderedHtml ? sanitizeHtml(renderedHtml) : "";

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

  return (
    <Tabs defaultValue="render" className="w-full h-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="render">Preview</TabsTrigger>
        <TabsTrigger value="source">Template Source</TabsTrigger>
      </TabsList>

      <TabsContent value="render" className="h-full relative mt-4">
        {safeHtml ? (
          <iframe
            sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
            className="w-full h-full min-h-[500px] border rounded-md"
            srcDoc={safeHtml}
            title="Template Preview"
            onLoad={() => setIframeLoading(false)}
            style={
              iframeLoading
                ? { visibility: "hidden" }
                : { visibility: "visible" }
            }
          />
        ) : (
          <div className="text-sm text-muted-foreground p-4">
            Fill in template arguments to see preview
          </div>
        )}
      </TabsContent>

      <TabsContent value="source" className="mt-4 h-full">
        <CodeViewer name="Template HTML" value={templateHtml} />
      </TabsContent>
    </Tabs>
  );
}
