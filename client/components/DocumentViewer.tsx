/**
 * DocumentViewer.tsx
 * This component displays uploaded documents for the chat sessions based on student type.
 * Maximizes space by removing headers and unnecessary UI elements.
 */
"use client";

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDocuments } from '@/utils/queries/get-documents';
import Markdown from '@/components/Markdown';

// Import shadcn UI components
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";


interface DocumentViewerProps {
  profile: string;
}

export default function DocumentViewer({ profile }: DocumentViewerProps) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [documentContent, setDocumentContent] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);

  // Fetch all documents for the profile
  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: () => getDocuments(),
    select: (data) => data?.filter(doc => doc.profile === profile)
  });

  // Set the first document as selected by default when documents load
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  // Fetch the content of the selected document
  useEffect(() => {
    if (!selectedDocId) return;

    const fetchDocumentContent = async () => {
      setIsLoadingContent(true);
      setContentError(null);
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/id/${selectedDocId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }
        
        // Get content type from response headers
        const contentTypeHeader = response.headers.get('content-type');
        setContentType(contentTypeHeader);
        
        // Handle different content types
        if (contentTypeHeader?.includes('application/pdf')) {
          // For PDFs, create a blob URL
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDocumentContent(url);
        } else if (contentTypeHeader?.includes('image/')) {
          // For images, create a blob URL
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDocumentContent(url);
        } else if (contentTypeHeader?.includes('text/')) {
          // For text files, get the text content
          const text = await response.text();
          setDocumentContent(text);
        } else {
          // For other types, create a blob URL for download
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setDocumentContent(url);
        }
      } catch (err) {
        console.error('Error fetching document:', err);
        setContentError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setIsLoadingContent(false);
      }
    };

    fetchDocumentContent();
    
    // Clean up blob URLs when component unmounts or document changes
    return () => {
      if (documentContent && (contentType?.includes('application/pdf') || contentType?.includes('image/'))) {
        URL.revokeObjectURL(documentContent);
      }
    };
  }, [selectedDocId]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="flex-1 h-full w-full flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-6">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="flex-1 h-full w-full flex items-center justify-center">
        <div className="text-destructive text-center p-6">
          <p className="mb-4">Failed to load documents</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // No documents state
  if (!documents || documents.length === 0) {
    return (
      <Card className="flex-1 h-full w-full flex items-center justify-center">
        <div className="text-muted-foreground text-center p-6">
          <p>No documents have been uploaded for this student type.</p>
        </div>
      </Card>
    );
  }

  // Find the currently selected document
  const selectedDoc = selectedDocId 
    ? documents.find(doc => doc.id === selectedDocId) 
    : documents[0];

  if (!selectedDoc) return null;

  // Document selector component
  const DocumentSelector = () => (
    <div className="absolute top-4 right-4 z-10 w-48">
      <Select value={selectedDocId || ''} onValueChange={setSelectedDocId}>
        <SelectTrigger className="bg-background/80 backdrop-blur-sm text-sm">
          <SelectValue placeholder="Select document" />
        </SelectTrigger>
        <SelectContent>
          {documents.map(doc => (
            <SelectItem key={doc.id} value={doc.id}>
              {doc.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Content loading state
  if (isLoadingContent) {
    return (
      <Card className="flex-1 h-full w-full relative">
        {documents.length > 1 && <DocumentSelector />}
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-muted-foreground">Loading document content...</div>
        </div>
      </Card>
    );
  }

  // Content error state
  if (contentError) {
    return (
      <Card className="flex-1 h-full w-full relative">
        {documents.length > 1 && <DocumentSelector />}
        <div className="h-full w-full flex flex-col items-center justify-center p-6">
          <p className="text-destructive mb-4">Error loading document: {contentError}</p>
          <Button 
            variant="outline" 
            onClick={() => {
              setContentError(null);
              setSelectedDocId(selectedDocId); // Trigger a refetch
            }}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // PDF document view
  if (contentType?.includes('application/pdf')) {
    return (
      <Card className="flex flex-col flex-1 min-h-0 relative overflow-hidden">
        {documents.length > 1 && <DocumentSelector />}
        <div className="flex-1 overflow-auto">
          <iframe 
            src={documentContent || ''}
            className="w-full h-full border-0"
            title={selectedDoc.name}
          />
        </div>
      </Card>
    );
  }
  
  // Markdown/text document view
  if (contentType?.includes('text/') || selectedDoc.name.endsWith('.md') || selectedDoc.name.endsWith('.txt')) {
    return (
      <Card className="flex flex-col flex-1 min-h-0 relative">
        {documents.length > 1 && <DocumentSelector />}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-4">
            {selectedDoc.name.endsWith('.md') || contentType?.includes('text/markdown') 
              ? <Markdown>{documentContent || ''}</Markdown>
              : <pre className="whitespace-pre-wrap font-sans text-sm">{documentContent || ''}</pre>
            }
          </div>
        </ScrollArea>
      </Card>
    );
  }
  
  // Image document view
  if (contentType?.includes('image/')) {
    return (
      <Card className="flex flex-col flex-1 min-h-0 relative">
        {documents.length > 1 && <DocumentSelector />}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="flex justify-center p-4 min-h-full">
            <img 
              src={documentContent || ''} 
              alt={selectedDoc.name}
              className="object-contain max-w-full" 
            />
          </div>
        </ScrollArea>
      </Card>
    );
  }
  
  // Default view for other file types
  return (
    <Card className="flex flex-col flex-1 min-h-0 relative">
      {documents.length > 1 && <DocumentSelector />}
      <ScrollArea className="flex-1 overflow-auto">
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <p className="mb-6 text-center text-muted-foreground">
            Preview not available for this file type ({contentType || 'unknown'}).
          </p>
          <Button 
            variant="default" 
            asChild
          >
            <a 
              href={documentContent || ''} 
              download={selectedDoc.name}
            >
              Download {selectedDoc.name.length > 20 ? `${selectedDoc.name.substring(0, 17)}...` : selectedDoc.name}
            </a>
          </Button>
        </div>
      </ScrollArea>
    </Card>
  );
}
