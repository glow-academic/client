/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { log } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLog, useLogColumns } from "@/hooks/use-log-columns";
import { getAppLogs } from "@/utils/logs/get-logs";
import type { DateRange } from "react-day-picker";
import { LogsDataTable } from "./LogsDataTable";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: logsData } = useQuery({
    queryKey: ["logs"],
    queryFn: () => getAppLogs({ page: 1, limit: 1000 }), // Get logs for client-side filtering
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["logs"] });
      log.info("logs.refresh.success", {
        message: "Logs refreshed successfully",
        context: { component: "Logs" },
      });
      toast.success("Logs refreshed successfully");
    } catch (error) {
      log.error("logs.refresh.failed", {
        message: "Error refreshing logs",
        error,
        context: { component: "Logs" },
      });
      toast.error("Failed to refresh logs");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleViewLog = (log: AppLog) => {
    setSelectedLog(log);
  };

  const { columns, levelOptions } = useLogColumns({
    onViewLog: handleViewLog,
  });

  // Build dynamic facet options from current data
  const {
    eventOptions,
    providerOptions,
    modelOptions,
    errorOptions,
    actorOptions,
    componentOptions,
    functionOptions,
  } = useMemo(() => {
    const logs = logsData?.logs ?? [];
    const events = new Set<string>();
    const providers = new Set<string>();
    const models = new Set<string>();
    const actors = new Set<string>();
    const components = new Set<string>();
    const functions = new Set<string>();
    let hasErrorTrue = false;
    let hasErrorFalse = false;

    const getContextString = (
      ctx: AppLog["context"],
      key: string
    ): string | undefined => {
      if (!ctx || typeof ctx !== "object") return undefined;
      const value = (ctx as Record<string, unknown>)[key];
      return typeof value === "string" ? value : undefined;
    };

    for (const l of logs) {
      if (l.event) events.add(l.event);
      const provider = getContextString(l.context, "provider");
      const model = getContextString(l.context, "model");
      const component = getContextString(l.context, "component");
      const fn = getContextString(l.context, "function");
      const actor = (() => {
        const a = (l.actor ?? null) as Record<string, unknown> | null;
        const profileName = a?.["profileName"] as string | undefined;
        const profileId = a?.["profileId"] as string | undefined;
        const userId = a?.["userId"] as string | undefined;
        return profileName ?? profileId ?? userId;
      })();
      if (provider) providers.add(provider);
      if (model) models.add(model);
      if (component) components.add(component);
      if (fn) functions.add(fn);
      if (actor) actors.add(actor);
      if (l.error) hasErrorTrue = true;
      else hasErrorFalse = true;
    }

    return {
      eventOptions: Array.from(events)
        .sort()
        .map((v) => ({ value: v, label: v })),
      providerOptions: Array.from(providers)
        .sort()
        .map((v) => ({ value: v, label: v })),
      modelOptions: Array.from(models)
        .sort()
        .map((v) => ({ value: v, label: v })),
      actorOptions: Array.from(actors)
        .sort()
        .map((v) => ({ value: v, label: v })),
      componentOptions: Array.from(components)
        .sort()
        .map((v) => ({ value: v, label: v })),
      functionOptions: Array.from(functions)
        .sort()
        .map((v) => ({ value: v, label: v })),
      errorOptions: [
        ...(hasErrorTrue ? [{ value: "true", label: "Yes" } as const] : []),
        ...(hasErrorFalse ? [{ value: "false", label: "No" } as const] : []),
      ],
    };
  }, [logsData]);

  return (
    <div className="space-y-6">
      <LogsDataTable
        columns={columns}
        data={logsData ? logsData.logs : []}
        levelOptions={levelOptions}
        eventOptions={eventOptions}
        providerOptions={providerOptions}
        modelOptions={modelOptions}
        errorOptions={errorOptions}
        actorOptions={actorOptions}
        componentOptions={componentOptions}
        functionOptions={functionOptions}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Detail Dialog */}
      <Dialog
        open={selectedLog !== null}
        onOpenChange={(open) => !open && setSelectedLog(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogDescription hidden>
            This dialog shows the log details.
          </DialogDescription>
          <div className="space-y-4">
            {selectedLog && (
              <div className="pt-4 pb-4 space-y-3">
                {/* Render a compact overview */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Event:</span>{" "}
                    {selectedLog.event}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Level:</span>{" "}
                    {selectedLog.level}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created:</span>{" "}
                    {selectedLog.createdAt ?? ""}
                  </div>
                  {selectedLog.correlationId && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">
                        Correlation:
                      </span>{" "}
                      <span className="font-mono">
                        {selectedLog.correlationId}
                      </span>
                    </div>
                  )}
                </div>

                {/* Full JSON */}
                <div className="bg-muted p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-xs font-mono">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
