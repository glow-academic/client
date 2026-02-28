"use client";

import type { ExportPageFn } from "@/app/(main)/layout-server";
import { Button } from "@/components/ui/button";
import { useAnalyticsParams } from "@/hooks/use-analytics-params";
import { Download, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

/** Map pathname prefix to the export page key */
function getExportPageFromPathname(pathname: string): string | null {
  if (pathname.startsWith("/home") || pathname === "/") return "home";
  if (pathname.startsWith("/analytics/dashboard")) return "dashboard";
  if (pathname.startsWith("/analytics/reports")) return "reports";
  if (pathname.startsWith("/record/")) return "reports";
  if (pathname.startsWith("/analytics/pricing")) return "pricing";
  if (pathname.startsWith("/group/")) return "pricing";
  if (pathname.startsWith("/leaderboard")) return "leaderboard";
  if (pathname.startsWith("/practice")) return "practice";
  if (pathname.startsWith("/training/personas")) return "personas";
  if (pathname.startsWith("/training/scenarios")) return "scenarios";
  if (pathname.startsWith("/training/simulations")) return "simulations";
  if (pathname.startsWith("/training/cohorts")) return "cohorts";
  return null;
}

export interface ExportButtonProps {
  exportPage: ExportPageFn;
}

export function ExportButton({ exportPage }: ExportButtonProps) {
  const pathname = usePathname();
  const [isExporting, setIsExporting] = useState(false);

  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedDepartmentIds,
    selectedRoles,
    simulationFilters,
  } = useAnalyticsParams();

  const page = getExportPageFromPathname(pathname);
  if (!page) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters: Record<string, unknown> = {
        start_date: startDate?.toISOString().split("T")[0] ?? null,
        end_date: endDate?.toISOString().split("T")[0] ?? null,
        cohort_ids: selectedCohortIds.length > 0 ? selectedCohortIds : null,
        department_ids:
          selectedDepartmentIds.length > 0 ? selectedDepartmentIds : null,
        roles: selectedRoles.length > 0 ? selectedRoles : null,
        simulation_filters:
          simulationFilters.length > 0 ? simulationFilters : null,
      };

      const result = await exportPage(page, filters);
      window.open(`/api/uploads/${result.upload_id}/download`, "_blank");
    } catch {
      toast.error("Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      title="Export data"
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  );
}
