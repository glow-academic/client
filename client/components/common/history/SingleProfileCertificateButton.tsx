"use client";

import { Table } from "@tanstack/react-table";
import { FileBadge2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { toast } from "sonner";

interface CohortData {
  name: string;
  passed: boolean;
  simulations: Array<{
    name: string;
    score: number;
    passed: boolean;
  }>;
}

export interface SingleProfileCertificateButtonProps<TData> {
  table: Table<TData>;
  profileOptions: { value: string; label: string }[];
  cohortData?: Array<{
    name: string;
    passed: boolean;
    simulations: Array<{
      name: string;
      score: number;
      passed: boolean;
    }>;
  }>;
}

export function SingleProfileCertificateButton<TData>({
  table,
  profileOptions,
  cohortData = [],
}: SingleProfileCertificateButtonProps<TData>) {
  const selectedRows = Object.keys(table.getState().rowSelection).length;
  const [isGenerating, setIsGenerating] = useState(false);
  const { effectiveProfile } = useProfile();

  // Function to generate certificate
  const handleCertificateGeneration = async () => {
    try {
      setIsGenerating(true);

      // Get the current user's profile from context
      if (!effectiveProfile?.id) {
        toast?.error("No user profile available");
        return;
      }

      const profileId = effectiveProfile.id;
      const profileName = `${effectiveProfile.firstName} ${effectiveProfile.lastName}`;

      // Use the pre-computed cohort data
      const finalCohortData: CohortData[] = cohortData;

      log.info("certificate.generate.start", {
        message: "Generating certificate",
        actor: { profileId },
        context: {
          component: "SingleProfileCertificateButton",
          profileName,
          cohortCount: cohortData.length,
          selectedRows,
          profileOptionsLength: profileOptions.length,
        },
      });

      // Call the certificate generation API
      const response = await fetch("/api/v2/documents/certificate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId,
          profileName,
          cohortData: finalCohortData,
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

      toast?.success(`Certificate generated for ${profileName}`);
    } catch (error) {
      log.error("certificate.generate.failed", {
        message: "Error generating certificate",
        error,
        context: { component: "SingleProfileCertificateButton" },
      });
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
