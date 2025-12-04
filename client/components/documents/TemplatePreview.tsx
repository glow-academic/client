/**
 * TemplatePreview.tsx
 * Preview component for Jinja templates with live refresh
 */

"use client";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CodeViewer from "@/components/common/chat/viewers/CodeViewer";

export interface TemplatePreviewProps {
  documentId: string | null;
  templateHtml: string | null;
  templateArgs: Record<string, any>;
  profileId: string;
  renderTemplateAction: (
    documentId: string,
    templateArgs: Record<string, any>,
    profileId: string
  ) => Promise<{ success: boolean; rendered_html: string }>;
}

export default function TemplatePreview({
  documentId,
  templateHtml,
  templateArgs,
  profileId,
  renderTemplateAction,
}: TemplatePreviewProps) {
  const [renderedHtml, setRenderedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Render template when args change
  useEffect(() => {
    if (!templateHtml) {
      setRenderedHtml("");
      return;
    }

    const renderTemplate = async () => {
      // If we have documentId, use render endpoint
      if (documentId) {
        setIsLoading(true);
        setError(null);
        try {
          const result = await renderTemplateAction(
            documentId,
            templateArgs,
            profileId
          );
          if (result.success) {
            setRenderedHtml(result.rendered_html);
          } else {
            setError("Failed to render template");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to render template");
          setRenderedHtml("");
        } finally {
          setIsLoading(false);
          setIframeLoading(true);
        }
      } else {
        // For new page, show template HTML with placeholder values
        // Note: This won't have theme colors, but shows the structure
        setRenderedHtml(templateHtml);
        setIsLoading(false);
      }
    };

    // Debounce rendering to avoid too many API calls
    const timeoutId = setTimeout(renderTemplate, 300);
    return () => clearTimeout(timeoutId);
  }, [documentId, templateHtml, templateArgs, profileId, renderTemplateAction]);

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
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/70">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
        {error && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}
        {!isLoading && !error && safeHtml && (
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
        )}
        {!isLoading && !error && !safeHtml && (
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

