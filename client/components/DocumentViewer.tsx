/**
 * DocumentViewer.tsx
 * This component displays uploaded documents for the chat sessions based on student type.
 * Maximizes space by removing headers and unnecessary UI elements.
 */
"use client";

import { useState, useEffect } from 'react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDocumentsByProfile, type StoredDocument } from '@/lib/documentStorage';
import Markdown from '@/components/Markdown';

interface DocumentViewerProps {
  profile: string;
}

export default function DocumentViewer({ profile }: DocumentViewerProps) {
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch documents from storage (API with localStorage fallback)
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      try {
        const docs = await getDocumentsByProfile(profile);
        setDocuments(docs);
        
        // Select first document by default
        if (docs.length > 0 && !selectedDocId) {
          setSelectedDocId(docs[0].id);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDocuments();
    
    // Listen for storage changes to refresh documents
    const handleStorageChange = () => fetchDocuments();
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [profile]);
  
  // Find the currently selected document
  const selectedDoc = selectedDocId 
    ? documents.find(doc => doc.id === selectedDocId) 
    : documents[0];
  
  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-card text-card-foreground border rounded-lg">
        <div className="text-muted-foreground">Loading document...</div>
      </div>
    );
  }
  
  if (documents.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-card text-card-foreground border rounded-lg">
        <div className="text-muted-foreground">
          <p>No documents have been uploaded for this student type.</p>
        </div>
      </div>
    );
  }

  // Document selector - only show if multiple documents
  const documentSelector = documents.length > 1 && (
    <div className="absolute top-2 right-2 z-10">
      <select 
        value={selectedDocId || ''} 
        onChange={(e) => setSelectedDocId(e.target.value)}
        className="text-xs p-1 border rounded bg-background/80 backdrop-blur-sm"
      >
        {documents.map(doc => (
          <option key={doc.id} value={doc.id}>
            {doc.name}
          </option>
        ))}
      </select>
    </div>
  );
  
  if (!selectedDoc) return null;
  
  // PDF document - use iframe that takes full container size
  if (selectedDoc.mimeType === 'application/pdf') {
    return (
      <div className="h-full w-full relative bg-card text-card-foreground border rounded-lg overflow-hidden">
        {documentSelector}
        <iframe 
          src={selectedDoc.content}
          className="w-full h-full border-0"
          title={selectedDoc.name}
        />
      </div>
    );
  }
  
  // Markdown/text document - use ScrollArea for proper scrolling
  if (selectedDoc.mimeType === 'text/markdown' || selectedDoc.name.endsWith('.md') || 
      selectedDoc.mimeType === 'text/plain' || selectedDoc.name.endsWith('.txt')) {
    // Extract text content
    const content = selectedDoc.content.startsWith('data:') 
      ? atob(selectedDoc.content.split(',')[1])
      : selectedDoc.content;
      
    return (
      <div className="h-full w-full relative bg-card text-card-foreground border rounded-lg overflow-hidden">
        {documentSelector}
        <ScrollArea className="h-full w-full">
          <div className="p-4">
            {selectedDoc.name.endsWith('.md') || selectedDoc.mimeType === 'text/markdown' 
              ? <Markdown>{content}</Markdown>
              : <pre className="whitespace-pre-wrap">{content}</pre>
            }
          </div>
        </ScrollArea>
      </div>
    );
  }
  
  // Image document - centered with proper scrolling
  if (selectedDoc.mimeType.startsWith('image/')) {
    return (
      <div className="h-full w-full relative bg-card text-card-foreground border rounded-lg overflow-hidden">
        {documentSelector}
        <ScrollArea className="h-full w-full">
          <div className="flex justify-center p-2 min-h-full">
            <img 
              src={selectedDoc.content} 
              alt={selectedDoc.name}
              className="object-contain max-w-full" 
            />
          </div>
        </ScrollArea>
      </div>
    );
  }
  
  // Default display for other file types
  return (
    <div className="h-full w-full relative bg-card text-card-foreground border rounded-lg overflow-hidden">
      {documentSelector}
      <ScrollArea className="h-full w-full">
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <p className="mb-4 text-center">Preview not available for this file type.</p>
          <a 
            href={selectedDoc.content} 
            download={selectedDoc.name}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Download {selectedDoc.name}
          </a>
        </div>
      </ScrollArea>
    </div>
  );
}
