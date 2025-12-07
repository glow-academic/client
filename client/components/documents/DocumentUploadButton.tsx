/**
 * DocumentUploadButton.tsx
 * Button for uploading documents (for use in layout)
 * @AshokSaravanan222 & @siladiea
 * 01/21/2025
 */
"use client";

import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export function DocumentUploadButton() {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("openDocumentUpload"));
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      data-testid="document-upload-button"
    >
      <Upload className="h-4 w-4 mr-2" />
      Upload Document(s)
    </Button>
  );
}
