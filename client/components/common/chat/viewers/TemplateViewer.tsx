/**
 * TemplateViewer.tsx
 * Renders HTML templates fetched from the BFF endpoint
 */
"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

export interface TemplateViewerProps {
  template: {
    template_id: string;
    name: string | null;
    description?: string | null;
  };
}

export default function TemplateViewer({ template }: TemplateViewerProps) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHtml = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/resources/templates/html", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: template.template_id }),
        });

        if (!response.ok) {
          throw new Error(`Failed to load template: ${response.status}`);
        }

        const result = await response.json();
        setHtml(result?.html ?? "");
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchHtml();
  }, [template.template_id]);

  // Sanitize HTML for security and add container styles
  const sanitizeHtml = (rawHtml: string): string => {
    const sanitized = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      .replace(/on\w+\s*=/gi, "data-removed=")
      .replace(/javascript:/gi, "data-removed:")
      .replace(/vbscript:/gi, "data-removed:");

    // Inject base styles to prevent horizontal overflow
    const baseStyles = `
      <style>
        html, body {
          max-width: 100% !important;
          overflow-x: hidden !important;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        * {
          max-width: 100% !important;
          box-sizing: border-box !important;
        }
        img, video, iframe, embed, object {
          max-width: 100% !important;
          height: auto !important;
        }
        pre, code {
          white-space: pre-wrap !important;
          word-wrap: break-word !important;
        }
      </style>
    `;

    // Insert styles at the beginning of the HTML
    if (sanitized.includes('<head>')) {
      return sanitized.replace('<head>', '<head>' + baseStyles);
    } else if (sanitized.includes('<html>')) {
      return sanitized.replace('<html>', '<html><head>' + baseStyles + '</head>');
    } else {
      return baseStyles + sanitized;
    }
  };

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
        <p className="text-sm text-muted-foreground">Failed to load template</p>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <FileText className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No content</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[400px] overflow-hidden">
      <iframe
        sandbox="allow-forms allow-pointer-lock allow-popups allow-same-origin"
        className="w-full h-full border-0 rounded-md"
        srcDoc={sanitizeHtml(html)}
        title={template.name ?? "Template"}
        style={{
          minHeight: "500px",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
