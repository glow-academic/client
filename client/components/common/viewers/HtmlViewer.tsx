"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import CodeViewer from "./CodeViewer";

export interface HtmlViewerProps {
  name?: string;
  content: string;
}

export default function HtmlViewer({ name, content }: HtmlViewerProps) {
  // Sanitize HTML content for security
  const sanitizeHtml = (html: string): string => {
    // Basic sanitization - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=/gi, "data-removed=")
      .replace(/javascript:/gi, "data-removed:")
      .replace(/vbscript:/gi, "data-removed:");
  };

  const safeHtml = sanitizeHtml(content);

  const [iframeLoading, setIframeLoading] = useState(true);

  return (
    <Tabs defaultValue="render" className="w-full h-full p-3">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="render">Rendered</TabsTrigger>
        <TabsTrigger value="source">Source</TabsTrigger>
      </TabsList>

      <TabsContent value="render" className="h-full relative">
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        <iframe
          sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
          className="w-full h-full min-h-[500px] border rounded-md"
          srcDoc={safeHtml}
          title={`HTML Preview - ${name || "Document"}`}
          onLoad={() => setIframeLoading(false)}
          style={
            iframeLoading ? { visibility: "hidden" } : { visibility: "visible" }
          }
        />
      </TabsContent>

      <TabsContent value="source" className="mt-2 h-full">
        <CodeViewer name={name || ""} value={content} />
      </TabsContent>
    </Tabs>
  );
}
