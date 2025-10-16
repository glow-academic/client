/**
 * DocumentPreviewCard.tsx
 * Enhanced document preview card with preview functionality
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */

"use client";

import DocumentViewer from "@/components/common/chat/DocumentViewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DocumentItem } from "@/lib/api/v2/schemas/documents";
import { Edit, Eye, Trash2 } from "lucide-react";
import * as React from "react";

export interface DocumentPreviewCardProps {
  document: DocumentItem;
  onEdit?: (document: DocumentItem) => void;
  onPreview?: (document: DocumentItem) => void;
  onDelete?: (document: DocumentItem) => void;
  canDelete?: boolean;
  showActions?: boolean;
  className?: string;
}

// Helper function to truncate text
const truncateText = (text: string, maxLength: number = 30): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
};

// Get document type icon
const getDocumentTypeIcon = (type: string) => {
  const typeMap: Record<string, string> = {
    homework: "📚",
    exam: "📝",
    syllabus: "📋",
    rubric: "📊",
    other: "📄",
  };
  return typeMap[type] || "📄";
};

export function DocumentPreviewCard({
  document: documentItem,
  onEdit,
  onPreview,
  onDelete,
  canDelete = true,
  showActions = true,
  className = "",
}: DocumentPreviewCardProps) {
  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);

  // Convert DocumentItem to Document for DocumentViewer
  const documentForViewer: Document = {
    id: documentItem.document_id,
    name: documentItem.name,
    type: documentItem.type as
      | "homework"
      | "project"
      | "quiz"
      | "midterm"
      | "lab"
      | "lecture"
      | "syllabus",
    active: documentItem.active,
    filePath: documentItem.file_path,
    mimeType: documentItem.mime_type,
    departmentId: documentItem.department_id,
    updatedAt: documentItem.updatedAt,
    createdAt: documentItem.updatedAt,
    classified: false,
    fileId: null,
  };

  const handlePreview = () => {
    if (onPreview) {
      onPreview(documentItem);
    } else {
      setShowPreviewDialog(true);
    }
  };

  return (
    <>
      <div
        className={`group relative border rounded-lg hover:shadow-md transition-all bg-white ${className}`}
      >
        {/* Action buttons - moved to top right */}
        {showActions && (
          <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
              onClick={handlePreview}
            >
              <Eye className="h-3 w-3" />
            </Button>
            {onEdit && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 bg-white/90 backdrop-blur-sm"
                onClick={() => onEdit(documentItem)}
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {onDelete && canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive bg-white/90 backdrop-blur-sm"
                onClick={() => onDelete(documentItem)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Document preview area */}
        <div
          className="aspect-square bg-muted rounded-lg relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handlePreview}
          style={{ cursor: "pointer" }}
        >
          {/* Document preview */}
          <div className="w-full h-full">
            <DocumentViewer
              document={documentForViewer}
              bare={true}
              isFormDocument={false}
            />
          </div>

          {/* Status indicators */}
          <div className="absolute top-1 left-1 flex gap-1">
            {!documentItem.active && (
              <Badge variant="secondary" className="text-xs">
                INACTIVE
              </Badge>
            )}
          </div>

          {/* Document name */}
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded max-w-[calc(100%-1rem)]">
            <span title={documentItem.name}>
              {truncateText(documentItem.name, 25)}
            </span>
          </div>

          {/* Type badge - moved to bottom right */}
          <div className="absolute bottom-2 right-2 z-10">
            <Badge variant="outline" className="text-xs">
              {getDocumentTypeIcon(documentItem.type)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="sm:max-w-4xl h-full max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{documentItem.name}</DialogTitle>
            <DialogDescription>
              Type: {documentItem.type}
              {!documentItem.active && (
                <span className="text-red-500 ml-2">(Inactive)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <DocumentViewer
              document={documentForViewer}
              bare={true}
              isFormDocument={false}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
