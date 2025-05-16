"use client";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardContent,
} from "@/components/ui/card";
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

interface DocumentViewerProps {
  profile: string;
}

export default function DocumentViewer({ profile }: DocumentViewerProps) {
  /* ------------------------------------------------------------------ */
  /*  state & data                                                      */
  /* ------------------------------------------------------------------ */
  const [docId, setDocId] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [type, setType]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [contentErr, setContentErr] = useState<string | null>(null);

  const { data: docs = [], isLoading, error } = useQuery({
    queryKey: ["documents"],
    queryFn : getDocuments,
    select  : (d) => d?.filter((x) => x.profile === profile) ?? [],
  });

  /* default first doc */
  useEffect(() => {
    if (docs.length && !docId) setDocId(docs[0].id);
  }, [docs, docId]);

  /* load selected doc */
  useEffect(() => {
    if (!docId) return;
    (async () => {
      try {
        setLoading(true); setContentErr(null);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/documents/id/${docId}`
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
  if (isLoading)
    return (
      <Skeleton className="h-full w-full rounded-lg" />
    );
  if (error || !docs.length)
    return null;

  /* ------------------------------------------------------------------ */
  /*  common shell – one card / one scroll region                       */
  /* ------------------------------------------------------------------ */
  const current = docs.find((d) => d.id === docId)!;

  return (
    <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* sticky header keeps dropdown visible */}
      <CardHeader className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b p-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={docId ?? ""} onValueChange={setDocId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select document" />
          </SelectTrigger>
          <SelectContent>
            {docs.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d?.name ?? ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>

      {/* scrollable body */}
      <CardContent className="flex-1 min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <span className="text-muted-foreground">Loading…</span>
          </div>
        ) : contentErr ? (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <p className="text-destructive">Error: {contentErr}</p>
            <Button variant="outline" onClick={() => setDocId(docId)}>
              Retry
            </Button>
          </div>
        ) : type?.includes("application/pdf") ? (
          <iframe
            src={content ?? ""}
            title={current?.name ?? ""}
            className="w-full h-full"
          />
        ) : type?.includes("image/") ? (
          <ScrollArea className="h-full">
            <Image
              src={content ?? ""}
              alt={current?.name ?? ""}
              className="object-contain mx-auto"
              loading="lazy"
              width={0}
              height={0}
              sizes="100vw"
              style={{ width: '100%', height: 'auto' }}
              unoptimized
            />
          </ScrollArea>
        ) : type?.includes("text/") || current?.name?.endsWith(".md") ? (
          <ScrollArea className="h-full p-4">
            {current?.name?.endsWith(".md") ? (
              <Markdown>{content ?? ""}</Markdown>
            ) : (
              <pre className="whitespace-pre-wrap text-sm">{content}</pre>
            )}
          </ScrollArea>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
