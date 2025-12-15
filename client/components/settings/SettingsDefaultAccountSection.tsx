/**
 * SettingsDefaultAccountSection.tsx
 * Card-based selection for default guest/admin accounts
 * Follows PersonaSection pattern
 */
"use client";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProfileMappingItem {
  profile_id: string;
  name: string;
  role: string;
  first_name: string;
  last_name: string;
}

type StepStatus = "pending" | "active" | "completed";

export interface SettingsDefaultAccountSectionProps {
  // Data
  profileMapping: Record<string, ProfileMappingItem>;
  validProfileIds: string[];
  selectedProfileId: string | null;

  // Callbacks
  onProfileIdChange: (profileId: string | null) => void;

  // UI State
  stepStatus: StepStatus;
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function SettingsDefaultAccountSection({
  profileMapping,
  validProfileIds,
  selectedProfileId,
  onProfileIdChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: SettingsDefaultAccountSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Filter profiles based on search term
  const filteredProfileIds = useMemo(() => {
    if (!searchTerm.trim()) {
      return validProfileIds;
    }
    const searchLower = searchTerm.toLowerCase();
    return validProfileIds.filter((profileId) => {
      const profile = profileMapping[profileId];
      if (!profile) return false;
      const searchText = `${profile.name} ${profile.first_name} ${profile.last_name} ${profile.role}`.toLowerCase();
      return searchText.includes(searchLower);
    });
  }, [validProfileIds, profileMapping, searchTerm]);

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50"
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-2 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div>
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-6">
        {/* Search bar */}
        <div className="flex h-9 items-center gap-2 border-b px-0">
          <Search className="size-4 shrink-0 opacity-50" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Filtered profiles grid */}
        <div className="grid grid-cols-2 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredProfileIds.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              {searchTerm ? "No accounts found" : "No accounts available"}
            </div>
          ) : (
            filteredProfileIds.map((profileId) => {
              const profile = profileMapping[profileId];
              if (!profile) return null;

              const isSelected = selectedProfileId === profileId;

              return (
                <button
                  key={profileId}
                  type="button"
                  onClick={() => {
                    if (isReadonly) return;
                    onProfileIdChange(isSelected ? null : profileId);
                  }}
                  disabled={isReadonly}
                  className={cn(
                    "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
                    "hover:shadow-md hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    isSelected && "ring-2 ring-primary bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {profile.first_name} {profile.last_name}
                      </div>
                      {profile.role && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {profile.role}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

