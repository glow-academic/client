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
import Markdown from "@/components/Markdown";
import { getDocuments } from "@/utils/queries/get-documents";
import Image from "next/image";
import { documents } from "@/drizzle/schema";

// Define types for props
type DocumentType = typeof documents.$inferSelect;

interface DocumentViewerProps {
  document?: DocumentType; // Direct document object
  profile?: string; // Or profile to filter by
  classId?: string; // Or classId to filter by
}

export default function DocumentViewer({
  document,
  profile,
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

  // Fetch documents if we're filtering by profile
  const {
    data: docs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: getDocuments,
    select: (data) => {
      // If we have a profile filter, apply it
      if (profile) {
        return data?.filter((x) => x.profile === profile) ?? [];
      }
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

  // Content rendering function to avoid duplication
  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <span className="text-muted-foreground">Loading…</span>
        </div>
      );
    }

    if (contentErr) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4">
          <p className="text-destructive">Error: {contentErr}</p>
          <Button variant="outline" onClick={() => setDocId(docId)}>
            Retry
          </Button>
        </div>
      );
    }

    if (type?.includes("application/pdf")) {
      return (
        <iframe
          src={content ?? ""}
          title={current?.name ?? ""}
          className="w-full h-full"
        />
      );
    }

    if (type?.includes("image/")) {
      return (
        <ScrollArea className="h-full">
          <Image
            src={content ?? ""}
            alt={current?.name ?? ""}
            className="object-contain mx-auto"
            loading="lazy"
            width={0}
            height={0}
            sizes="100vw"
            style={{ width: "100%", height: "auto" }}
            unoptimized
          />
        </ScrollArea>
      );
    }

    if (type?.includes("text/") || current?.name?.endsWith(".md")) {
      return (
        <ScrollArea className="h-full p-4">
          {current?.name?.endsWith(".md") ? (
            <Markdown>{content ?? ""}</Markdown>
          ) : (
            <pre className="whitespace-pre-wrap text-sm">{content}</pre>
          )}
        </ScrollArea>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground text-center">
          No preview for this file type ({type}).
        </p>
        <Button asChild>
          <a href={content ?? ""} download={current?.name ?? ""}>
            Download
          </a>
        </Button>
      </div>
    );
  };

  // If we only have a single document, show content directly without the selector
  if (document && !profile && !classId) {
    return <div className="h-full overflow-hidden">{renderContent()}</div>;
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
              {documentsToUse.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d?.name ?? ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      )}

      {/* scrollable body */}
      <CardContent className="flex-1 min-h-0">{renderContent()}</CardContent>
    </Card>
  );
}
