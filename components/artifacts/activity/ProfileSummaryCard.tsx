"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type ProfileSummaryItemType = {
  profile_id?: string | null;
  profile_name?: string | null;
  sessions_count?: number;
  logins_count?: number;
  grants_count?: number;
  problems_count?: number;
  activity_count?: number;
};

interface ProfileSummaryCardProps {
  items: ProfileSummaryItemType[];
  selectedProfileId?: string | null;
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
      <span className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</span>
      <span className="text-xs text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

export default function ProfileSummaryCard({ items, selectedProfileId }: ProfileSummaryCardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleProfileChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all") {
        params.delete("summaryProfileId");
      } else {
        params.set("summaryProfileId", value);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Aggregate all items if no specific profile selected, or show the selected one
  const aggregated = selectedProfileId
    ? items.find((i) => i.profile_id === selectedProfileId) || null
    : items.reduce(
        (acc, i) => ({
          sessions_count: acc.sessions_count + (i.sessions_count ?? 0),
          logins_count: acc.logins_count + (i.logins_count ?? 0),
          grants_count: acc.grants_count + (i.grants_count ?? 0),
          problems_count: acc.problems_count + (i.problems_count ?? 0),
          activity_count: acc.activity_count + (i.activity_count ?? 0),
        }),
        { sessions_count: 0, logins_count: 0, grants_count: 0, problems_count: 0, activity_count: 0 }
      );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Summary
            </CardTitle>
            <CardDescription className="text-sm">
              {selectedProfileId ? "Individual profile stats" : "Aggregate stats across all profiles"}
            </CardDescription>
          </div>
          <Select
            value={selectedProfileId || "all"}
            onValueChange={handleProfileChange}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Profiles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Profiles</SelectItem>
              {items.map((item) =>
                item.profile_id ? (
                  <SelectItem key={item.profile_id} value={item.profile_id}>
                    {item.profile_name || item.profile_id.substring(0, 8)}
                  </SelectItem>
                ) : null
              )}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center">
        {aggregated ? (
          <div className="grid grid-cols-5 gap-3 w-full">
            <StatBlock label="Sessions" value={aggregated.sessions_count ?? 0} />
            <StatBlock label="Logins" value={aggregated.logins_count ?? 0} />
            <StatBlock label="Activity" value={aggregated.activity_count ?? 0} />
            <StatBlock label="Grants" value={aggregated.grants_count ?? 0} />
            <StatBlock label="Problems" value={aggregated.problems_count ?? 0} />
          </div>
        ) : (
          <div className="text-center text-muted-foreground w-full py-8">
            No data available for the selected profile
          </div>
        )}
      </CardContent>
    </Card>
  );
}
