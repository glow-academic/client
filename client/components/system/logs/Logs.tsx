/**
 * Logs.tsx
 * Used to display the logs page with table-based filtering and card layout.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { log } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppLog, useLogColumns } from "@/hooks/use-log-columns";
import type { DateRange } from "react-day-picker";
import { LogsDataTable } from "./LogsDataTable";

import {
  Dialog,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAppLogs } from "@/lib/api/hooks/app_logs";
import { useProfiles } from "@/lib/api/hooks/profiles";

export default function Logs() {
  const [selectedLog, setSelectedLog] = useState<AppLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const queryClient = useQueryClient();

  const { data: logsData = [] } = useAppLogs(); // TODO: need some limiting here

  const { data: profilesData = [] } = useProfiles();

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

  type ProfileRow = { id?: string; firstName?: string; lastName?: string };
  const profileIdToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of (profilesData as unknown as ProfileRow[]) ?? []) {
      const first = p?.firstName;
      const last = p?.lastName;
      const id = p?.id;
      if (id) {
        const full = [first, last].filter(Boolean).join(" ");
        if (full) map.set(id, full);
      }
    }
    return map;
  }, [profilesData]);

  const resolveActorName = useCallback(
    (actor: Record<string, unknown> | null | undefined) => {
      if (!actor) return null;
      const explicit = actor["profileName"] as string | undefined;
      if (explicit) return explicit;
      const profileId = actor["profileId"] as string | undefined;
      if (profileId && profileIdToName.has(profileId))
        return profileIdToName.get(profileId)!;
      const userId = actor["userId"] as string | undefined;
      return explicit ?? profileId ?? userId ?? null;
    },
    [profileIdToName],
  );

  const { columns, levelOptions } = useLogColumns({
    onViewLog: handleViewLog,
    resolveActorName,
  });

  // Build dynamic facet options from current data
  const {
    eventOptions,
    providerOptions,
    modelOptions,
    actorOptions,
    componentOptions,
    functionOptions,
  } = useMemo(() => {
    const logs = logsData ?? [];
    const events = new Set<string>();
    const providers = new Set<string>();
    const models = new Set<string>();
    const actors = new Set<string>();
    const components = new Set<string>();
    const functions = new Set<string>();
    // hasError flags removed

    const getContextString = (
      ctx: unknown,
      key: string,
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
      const actor = resolveActorName(
        l.actor as Record<string, unknown> | null | undefined,
      );
      if (provider) providers.add(provider);
      if (model) models.add(model);
      if (component) components.add(component);
      if (fn) functions.add(fn);
      if (actor) actors.add(actor);
      // hasError counting removed
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
      // hasError options removed
    };
  }, [logsData, resolveActorName]);

  return (
    <div className="space-y-6">
      <LogsDataTable
        columns={columns}
        data={logsData}
        levelOptions={levelOptions}
        eventOptions={eventOptions}
        providerOptions={providerOptions}
        modelOptions={modelOptions}
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
