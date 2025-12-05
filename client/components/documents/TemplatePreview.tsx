/**
 * TemplatePreview.tsx
 * Preview component for Jinja templates with live refresh
 */

"use client";
import HtmlViewer from "@/components/common/chat/viewers/HtmlViewer";
import CodeViewer from "@/components/common/chat/viewers/CodeViewer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // When documentId exists, use HtmlViewer for consistent rendering
  // Show rendered HTML if available, otherwise show template source
  if (renderedHtml) {
    return (
      <HtmlViewer
        name={documentId ? "Template Preview" : "Template Source"}
        content={renderedHtml}
      />
    );
  }

  // If no rendered HTML but we have template HTML, show source
  if (templateHtml) {
    return (
      <HtmlViewer
        name={documentId ? "Template Source" : "Template Source"}
        content={templateHtml}
      />
    );
  }

  // Fallback message
  return (
    <div className="text-sm text-muted-foreground p-4">
      Fill in template arguments to see preview
    </div>
  );
}
