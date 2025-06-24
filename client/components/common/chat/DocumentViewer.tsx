"use client";
import Markdown from "@/components/common/chat/Markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Document } from "@/types";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

interface DocumentViewerProps {
  document?: Document;
  bare?: boolean;
  classId?: string;
}

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
  classId,
  bare = true,
}: DocumentViewerProps) {
  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents if filtering by classId
  const {
    data: docs = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ["documents", classId],
    queryFn: () => getAllDocuments(),
    enabled: !!classId,
  });

  // Memoize documentsToUse to prevent unnecessary re-renders
  const documentsToUse = useMemo(() => {
    return document ? [document] : docs;
  }, [document, docs]);

  const showSelector = documentsToUse.length > 1;

  // Set default document
  useEffect(() => {
    if (document) {
      setDocId(document.id);
    } else if (documentsToUse.length && !docId && documentsToUse[0]) {
      setDocId(documentsToUse[0].id);
    }
  }, [documentsToUse, docId, document]);

  // Load selected document
  useEffect(() => {
    if (!docId) return;

    const loadDocument = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `${process.env["NEXT_PUBLIC_API_URL"]}/documents/id/${docId}`
        );
        if (!res.ok) throw new Error("Failed to load document");

        const contentType = res.headers.get("content-type") ?? "";
        setType(contentType);

        if (contentType.includes("text/")) {
          setContent(await res.text());
        } else {
          const blob = await res.blob();
          setContent(URL.createObjectURL(blob));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [docId]);

  // Loading state
  if (isLoading && !document) {
    return <Skeleton className="h-full w-full rounded-lg" />;
  }

  // Error or no documents
  if ((queryError || !documentsToUse.length) && !document) {
    return null;
  }

  const current = documentsToUse.find((d) => d.id === docId);
  if (!current) return null;

  const typeInfo = getDocumentTypeInfo(current.type || "homework");

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
      return (
        <div className="w-full h-full min-h-[400px] flex flex-col">
          <iframe
            src={`${content}#view=FitH&toolbar=1&navpanes=0&scrollbar=1`}
            title={current.name ?? ""}
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
        <div className="w-full flex justify-center p-4">
          <Image
            src={content ?? ""}
            alt={current.name ?? ""}
            className="max-w-full h-auto rounded-md shadow-sm"
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "100%", height: "auto" }}
            unoptimized
          />
        </div>
      );
    }

    // Text/Markdown viewer
    if (type?.includes("text/") || current.name?.endsWith(".md")) {
      return (
        <div className="w-full p-4">
          {current.name?.endsWith(".md") ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <Markdown>{content ?? ""}</Markdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-3 rounded-md overflow-x-auto">
              {content}
            </pre>
          )}
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

  // Single document view (no selector)
  if (document && !classId) {
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
            <span className="text-sm font-medium truncate">
              {document.name}
            </span>
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

  // Multi-document view with selector
  return (
    <Card className="w-full h-full flex flex-col overflow-hidden">
      {showSelector && (
        <CardHeader className="p-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Select value={docId ?? ""} onValueChange={setDocId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select document" />
              </SelectTrigger>
              <SelectContent>
                {documentsToUse.map((d) => {
                  const docTypeInfo = getDocumentTypeInfo(d.type || "homework");
                  return (
                    <SelectItem key={d.id} value={d.id}>
                      <div className="flex items-center gap-2">
                        <span>{docTypeInfo.icon}</span>
                        <span className="truncate">{d.name ?? ""}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" asChild className="shrink-0">
              <a href={content ?? ""} download={current.name ?? ""}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </CardHeader>
      )}

      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full">{renderContent()}</ScrollArea>
      </CardContent>
    </Card>
  );
}
