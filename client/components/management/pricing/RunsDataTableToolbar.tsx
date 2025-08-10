"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DatePickerWithRange } from "@/components/ui/date-picker-range";
import type { DateRange } from "react-day-picker";

export interface OptionItem {
  value: string;
  label: string;
}

export interface RunsDataTableToolbarProps {
  modelOptions: OptionItem[];
  agentOptions: OptionItem[];
  profileOptions: OptionItem[];
  selectedModelIds: string[];
  selectedAgentIds: string[];
  selectedProfileIds: string[];
  setSelectedModelIds: (ids: string[]) => void;
  setSelectedAgentIds: (ids: string[]) => void;
  setSelectedProfileIds: (ids: string[]) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function RunsDataTableToolbar({
  modelOptions,
  agentOptions,
  profileOptions,
  selectedModelIds,
  selectedAgentIds,
  selectedProfileIds,
  setSelectedModelIds,
  setSelectedAgentIds,
  setSelectedProfileIds,
  dateRange,
  setDateRange,
  isRefreshing = false,
  onRefresh,
}: RunsDataTableToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search by Run ID (optional lightweight search) */}
        <Input
          placeholder="Search run id..."
          className="h-8 w-[160px] lg:w-[240px]"
          onChange={() => {}}
        />

        {/* Model filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Models
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search models..." />
              <CommandEmpty>No models found.</CommandEmpty>
              <CommandList>
                {modelOptions.map((m) => {
                  const checked = selectedModelIds.includes(m.value);
                  return (
                    <CommandItem
                      key={m.value}
                      onSelect={() => {
                        const next = new Set(selectedModelIds);
                        if (checked) next.delete(m.value);
                        else next.add(m.value);
                        setSelectedModelIds(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{m.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Agent filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              Agents
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search agents..." />
              <CommandEmpty>No agents found.</CommandEmpty>
              <CommandList>
                {agentOptions.map((a) => {
                  const checked = selectedAgentIds.includes(a.value);
                  return (
                    <CommandItem
                      key={a.value}
                      onSelect={() => {
                        const next = new Set(selectedAgentIds);
                        if (checked) next.delete(a.value);
                        else next.add(a.value);
                        setSelectedAgentIds(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{a.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Profile filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed">
              People
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-0">
            <Command>
              <CommandInput placeholder="Search people..." />
              <CommandEmpty>No people found.</CommandEmpty>
              <CommandList>
                {profileOptions.map((p) => {
                  const checked = selectedProfileIds.includes(p.value);
                  return (
                    <CommandItem
                      key={p.value}
                      onSelect={() => {
                        const next = new Set(selectedProfileIds);
                        if (checked) next.delete(p.value);
                        else next.add(p.value);
                        setSelectedProfileIds(Array.from(next));
                      }}
                    >
                      <Checkbox checked={checked} className="mr-2" />
                      <span className="truncate">{p.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Selection badges (compact) */}
        <div className="flex flex-wrap gap-1">
          {selectedModelIds.slice(0, 4).map((id) => {
            const label = modelOptions.find((o) => o.value === id)?.label ?? id;
            return (
              <Badge key={id} variant="secondary" className="font-normal">
                {label}
              </Badge>
            );
          })}
          {selectedAgentIds.slice(0, 3).map((id) => {
            const label = agentOptions.find((o) => o.value === id)?.label ?? id;
            return (
              <Badge key={id} variant="outline" className="font-normal">
                {label}
              </Badge>
            );
          })}
          {selectedProfileIds.length > 0 && (
            <Badge variant="outline" className="font-normal">
              {selectedProfileIds.length} person{selectedProfileIds.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Date range on the right for consistency */}
        <DatePickerWithRange dateRange={dateRange} setDateRange={setDateRange} />

        {/* Refresh */}
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 px-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        )}
      </div>
    </div>
  );
}


