"use client";

import { Table } from "@tanstack/react-table";
import { FileBadge2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { toast } from "sonner";

export interface SingleProfileCertificateButtonProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
}

export function SingleProfileCertificateButton<TData>({
  table,
  profileOptions: _profileOptions,
}: SingleProfileCertificateButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [isGenerating, setIsGenerating] = useState(false);
  const { profile } = useProfile();
  // Function to generate certificate
  const handleCertificateGeneration = async () => {
    try {
      setIsGenerating(true);

      // Get the current user's profile from context
      if (!profile?.id) {
        toast?.error("No user profile available");
        return;
      }

      const profileId = profile.id;

      // Call the certificate generation API
      const response = await fetch("/api/artifacts/attempt/certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate certificate");
      }

      // Handle direct file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition");
      let filename = "certificate.pdf";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast?.success("Certificate generated successfully");
    } catch {
      toast?.error("Failed to generate certificate");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleCertificateGeneration}
      disabled={isGenerating}
      className="w-full md:w-auto"
    >
      {isGenerating ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Generating...
        </>
      ) : (
        <>
          <FileBadge2 className="h-4 w-4" />
          Download Certificate {selectedRows > 0 ? `(${selectedRows})` : ""}
        </>
      )}
    </Button>
  );
}
