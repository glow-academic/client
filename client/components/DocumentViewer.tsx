"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Markdown from "@/components/Markdown";
import { getDocuments } from "@/utils/queries/get-documents";
import Image from "next/image";
import { documents } from "@/drizzle/schema";
import { FileText, Download, ExternalLink } from "lucide-react";

// Define types for props
type DocumentType = typeof documents.$inferSelect;

interface DocumentViewerProps {
  document?: DocumentType; // Direct document object
  classId?: string; // Or classId to filter by
}

// Get document type info
const getDocumentTypeInfo = (type: string) => {
  const typeOptions = [
    { value: "homework", label: "📝 Homework", icon: "📝", color: "bg-blue-500" },
    { value: "project", label: "🚀 Project", icon: "🚀", color: "bg-purple-500" },
    { value: "quiz", label: "❓ Quiz", icon: "❓", color: "bg-yellow-500" },
    { value: "midterm", label: "📊 Midterm", icon: "📊", color: "bg-red-500" },
    { value: "lab", label: "🧪 Lab", icon: "🧪", color: "bg-green-500" },
  ];
  
  const typeInfo = typeOptions.find(t => t.value === type);
  return typeInfo || { value: type, label: type, icon: "📄", color: "bg-gray-500" };
};

export default function DocumentViewer({
  document,
  classId,
}: DocumentViewerProps) {
  /* ------------------------------------------------------------------ */
  /*  state & data                                                      */
  /* ------------------------------------------------------------------ */
  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentErr, setContentErr] = useState<string | null>(null);

  // Fetch documents if we're filtering by classId
  const {
    data: docs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
    select: (data) => {
      // If we have a classId filter, apply it
      if (classId) {
        return data?.filter((x) => x.classId === classId) ?? [];
      }
      // Otherwise return all documents
      return data ?? [];
    },
    // Skip query if we already have a direct document
    enabled: !document,
  });

  // If we have a direct document, use it instead of fetched docs
  const documentsToUse = document ? [document] : docs;
  const showDocumentSelector = documentsToUse.length > 1;

  /* default first doc */
  useEffect(() => {
    if (document) {
      // If direct document is provided, use its ID
      setDocId(document.id);
    } else if (documentsToUse.length && !docId) {
      // Otherwise use first document from filtered list
      setDocId(documentsToUse[0].id);
    }
  }, [documentsToUse, docId, document]);

  /* load selected doc */
  useEffect(() => {
    if (!docId) return;
    (async () => {
      try {
        setLoading(true);
        setContentErr(null);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/documents/id/${docId}`,
        );
        if (!res.ok) throw new Error(res.statusText);
        const cType = res.headers.get("content-type") ?? "";
        setType(cType);

        /* decide how to read */
        if (cType.includes("text/")) setContent(await res.text());
        else {
          const blob = await res.blob();
          setContent(URL.createObjectURL(blob));
        }
      } catch (e) {
        setContentErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [docId]);

  /* ------------------------------------------------------------------ */
  /*  early states                                                      */
  /* ------------------------------------------------------------------ */
  if (isLoading && !document)
    return <Skeleton className="h-full w-full rounded-lg" />;
  if ((error || !documentsToUse.length) && !document) return null;

  /* ------------------------------------------------------------------ */
  /*  common shell – one card / one scroll region                       */
  /* ------------------------------------------------------------------ */
  const current = documentsToUse.find((d) => d.id === docId)!;
  const typeInfo = getDocumentTypeInfo(current?.type || "homework");

  // Enhanced content rendering function
  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <span className="text-muted-foreground">Loading document...</span>
          </div>
        </div>
      );
    }

    if (contentErr) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <div className="text-center space-y-2">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-destructive">Error loading document</p>
            <p className="text-sm text-muted-foreground">{contentErr}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDocId(docId)}>
              Retry
            </Button>
            <Button asChild>
              <a 
                href={`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${docId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in New Tab
              </a>
            </Button>
          </div>
        </div>
      );
    }

    if (type?.includes("application/pdf")) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">PDF Document</span>
              <Badge variant="outline" className={`${typeInfo.color} text-white border-none`}>
                {typeInfo.icon} {typeInfo.label.split(' ')[1]}
              </Badge>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href={content ?? ""} download={current?.name ?? ""}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
          <iframe
            src={content ?? ""}
            title={current?.name ?? ""}
            className="flex-1 w-full border-0"
          />
        </div>
      );
    }

    if (type?.includes("image/")) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Image</span>
              <Badge variant="outline" className={`${typeInfo.color} text-white border-none`}>
                {typeInfo.icon} {typeInfo.label.split(' ')[1]}
              </Badge>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href={content ?? ""} download={current?.name ?? ""}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 flex justify-center">
              <Image
                src={content ?? ""}
                alt={current?.name ?? ""}
                className="object-contain max-w-full h-auto rounded-lg shadow-sm"
                loading="lazy"
                width={0}
                height={0}
                sizes="100vw"
                style={{ width: "auto", height: "auto", maxHeight: "80vh" }}
                unoptimized
              />
            </div>
          </ScrollArea>
        </div>
      );
    }

    if (type?.includes("text/") || current?.name?.endsWith(".md")) {
      return (
        <div className="h-full flex flex-col">
          <div className="flex justify-between items-center p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="text-sm font-medium">
                {current?.name?.endsWith(".md") ? "Markdown" : "Text"} Document
              </span>
              <Badge variant="outline" className={`${typeInfo.color} text-white border-none`}>
                {typeInfo.icon} {typeInfo.label.split(' ')[1]}
              </Badge>
            </div>
            <Button size="sm" variant="outline" asChild>
              <a href={content ?? ""} download={current?.name ?? ""}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </a>
            </Button>
          </div>
          <ScrollArea className="flex-1 p-4">
            {current?.name?.endsWith(".md") ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Markdown>{content ?? ""}</Markdown>
              </div>
            ) : (
              <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/30 p-4 rounded-lg">
                {content}
              </pre>
            )}
          </ScrollArea>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            Preview not available for this file type
          </p>
          <p className="text-sm text-muted-foreground">
            {type || "Unknown file type"}
          </p>
          <Badge variant="outline" className={`${typeInfo.color} text-white border-none`}>
            {typeInfo.icon} {typeInfo.label.split(' ')[1]}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <a href={content ?? ""} download={current?.name ?? ""}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a 
              href={`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${docId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </a>
          </Button>
        </div>
      </div>
    );
  };

  // If we only have a single document, show content directly without the selector
  if (document && !classId) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        {/* Document header with type info */}
        <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
          <span className="text-sm font-medium truncate">{document.name}</span>
          <Badge variant="outline" className={`${typeInfo.color} text-white border-none`}>
            {typeInfo.icon} {typeInfo.label.split(' ')[1]}
          </Badge>
        </div>
        <div className="flex-1 min-h-0">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <Card className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
      {/* sticky header keeps dropdown visible */}
      {showDocumentSelector && (
        <CardHeader className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={docId ?? ""} onValueChange={setDocId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select document" />
            </SelectTrigger>
            <SelectContent>
              {documentsToUse.map((d) => {
                const docTypeInfo = getDocumentTypeInfo(d.type || "homework");
                return (
                  <SelectItem key={d.id} value={d.id}>
                    <div className="flex items-center gap-2">
                      <span>{docTypeInfo.icon}</span>
                      <span>{d?.name ?? ""}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          {current && (
            <Badge variant="outline" className={`${typeInfo.color} text-white border-none shrink-0`}>
              {typeInfo.icon} {typeInfo.label.split(' ')[1]}
            </Badge>
          )}
        </CardHeader>
      )}

      {/* scrollable body */}
      <CardContent className="flex-1 min-h-0 p-0">{renderContent()}</CardContent>
    </Card>
  );
}
