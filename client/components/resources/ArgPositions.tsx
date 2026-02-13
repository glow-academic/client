"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { OutputOf } from "@/lib/api/types";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

// Derive resource item type from the GET endpoint response
type ArgPositionsGetResponse = OutputOf<"/api/v4/resources/arg_positions/get", "post">;
export type ArgPositionResourceItem = NonNullable<ArgPositionsGetResponse["items"]>[number];

type CreateDraftArgPositionsIn = {
  body: {
    agent_id: string;
    group_id: string;
    tool_id: string;
    args_id: string;
    value: number;
    mcp: boolean;
  };
};
type CreateDraftArgPositionsOut = {
  id?: string | null;
};

export interface ArgPositionItem {
  args_id: string;
  value: number;
  generated?: boolean;
}

interface ArgPositionsProps {
  args_ids: string[];
  args_resources?: Array<{
    id?: string | null;
    name?: string | null;
  }>;
  arg_position_ids?: string[];
  arg_position_resources?: ArgPositionResourceItem[];
  group_id?: string | null;
  tool_id?: string | null;
  create_tool_id?: string | null;
  disabled?: boolean;
  onPositionIdsChange?: (ids: string[]) => void;
  onOrderChange?: (orderedArgsIds: string[]) => void;
  createArgPositionsAction?: (
    input: CreateDraftArgPositionsIn
  ) => Promise<CreateDraftArgPositionsOut>;
  isAutosaveEnabled?: boolean;
  registerFlush?: (flush: () => Promise<{ arg_position_ids: string[] } | void>) => void;
  showAiGenerate?: boolean;
  onGenerate?: () => void | Promise<void>;
  isGenerating?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export function ArgPositions({
  args_ids,
  args_resources,
  arg_position_resources,
  group_id,
  tool_id,
  create_tool_id,
  disabled = false,
  onPositionIdsChange,
  onOrderChange,
  createArgPositionsAction,
  isAutosaveEnabled = true,
  registerFlush,
  showAiGenerate: _showAiGenerate = false,
  onGenerate: _onGenerate,
  isGenerating: _isGenerating = false,
  onAccept: _onAccept,
  onReject: _onReject,
}: ArgPositionsProps) {
  const [orderedArgs, setOrderedArgs] = useState<string[]>(args_ids);
  const [positionIdsByArg, setPositionIdsByArg] = useState<Map<string, string>>(
    new Map()
  );

  const argNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (args_resources ?? []).forEach((arg) => {
      if (arg.id) {
        map.set(arg.id, arg.name?.trim() || "Unnamed arg");
      }
    });
    return map;
  }, [args_resources]);

  useEffect(() => {
    const valueByArg = new Map<string, number>();
    const idByArg = new Map<string, string>();

    (arg_position_resources ?? []).forEach((item) => {
      if (item.args_id && item.value !== null && item.value !== undefined) {
        valueByArg.set(item.args_id, item.value);
      }
      if (item.args_id && item.id) {
        idByArg.set(item.args_id, item.id);
      }
    });

    const nextOrder = [...args_ids].sort((a, b) => {
      const av = valueByArg.get(a);
      const bv = valueByArg.get(b);
      if (av === undefined && bv === undefined) return 0;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      return av - bv;
    });

    setOrderedArgs(nextOrder);
    setPositionIdsByArg(idByArg);
  }, [args_ids, arg_position_resources]);

  useEffect(() => {
    onOrderChange?.(orderedArgs);
  }, [orderedArgs, onOrderChange]);

  useEffect(() => {
    if (!onPositionIdsChange) return;
    const ids = orderedArgs
      .map((argId) => positionIdsByArg.get(argId))
      .filter((id): id is string => !!id);
    onPositionIdsChange(ids);
  }, [onPositionIdsChange, orderedArgs, positionIdsByArg]);

  const saveAllPositionsRef = useRef<
    (() => Promise<{ arg_position_ids: string[] } | void>) | undefined
  >(undefined);

  saveAllPositionsRef.current = async () => {
    if (!createArgPositionsAction || !group_id || !tool_id || !create_tool_id) {
      const ids = orderedArgs
        .map((argId) => positionIdsByArg.get(argId))
        .filter((id): id is string => !!id);
      return { arg_position_ids: ids };
    }

    const nextMap = new Map(positionIdsByArg);

    for (const [index, argsId] of orderedArgs.entries()) {
      const result = await createArgPositionsAction({
        body: {
          agent_id: create_tool_id,
          group_id,
          tool_id,
          args_id: argsId,
          value: index,
          mcp: false,
        },
      });

      if (result?.id) {
        nextMap.set(argsId, result.id);
      }
    }

    setPositionIdsByArg(nextMap);

    const ids = orderedArgs
      .map((argId) => nextMap.get(argId))
      .filter((id): id is string => !!id);

    return { arg_position_ids: ids };
  };

  useEffect(() => {
    if (registerFlush) {
      registerFlush(() => saveAllPositionsRef.current?.() ?? Promise.resolve());
    }
  }, [registerFlush]);

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedArgs.length) return;

    const next = [...orderedArgs];
    const tmp = next[index];
    next[index] = next[target]!;
    next[target] = tmp!;
    setOrderedArgs(next);

    if (isAutosaveEnabled) {
      await saveAllPositionsRef.current?.();
    }
  };

  if (!args_ids.length) {
    return <p className="text-sm text-muted-foreground">Select args to configure positions.</p>;
  }

  return (
    <div className="space-y-3" data-resource="arg_positions">
      <Label>Argument Positions</Label>
      <div className="space-y-2">
        {orderedArgs.map((argId, index) => (
          <div
            key={argId}
            className="flex items-center justify-between rounded-md border p-3"
          >
            <div>
              <p className="text-sm font-medium">{index + 1}. {argNameMap.get(argId) ?? "Unnamed arg"}</p>
              <p className="text-xs text-muted-foreground">Stored value: {index}</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || index === 0}
                onClick={() => void move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled || index === orderedArgs.length - 1}
                onClick={() => void move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
