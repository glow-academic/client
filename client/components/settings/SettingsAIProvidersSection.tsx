/**
 * SettingsAIProvidersSection.tsx
 * Card-based selection for AI providers
 * Follows PersonaSection pattern
 */
"use client";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AIProvider {
  provider_id: string;
  provider_name: string;
  provider_description: string;
  provider_value: string | null;
  selected_key_id: string | null;
  enabled: boolean;
}

export interface SettingsAIProvidersSectionProps {
  providers: AIProvider[];
  onProviderClick: (providerId: string) => void;
  stepStatus: "pending" | "active" | "completed";
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function SettingsAIProvidersSection({
  providers,
  onProviderClick,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: SettingsAIProvidersSectionProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProviders = useMemo(() => {
    if (!searchTerm.trim()) return providers;
    const term = searchTerm.toLowerCase();
    return providers.filter(
      (provider) =>
        provider.provider_name.toLowerCase().includes(term) ||
        provider.provider_description.toLowerCase().includes(term)
    );
  }, [providers, searchTerm]);

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
            placeholder="Search AI providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="placeholder:text-muted-foreground flex h-9 w-full bg-transparent py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isReadonly}
          />
        </div>

        {/* Filtered providers grid */}
        <div className="grid grid-cols-2 gap-4 min-h-[272px] max-h-[272px] overflow-y-auto py-2 -mx-6 px-6">
          {filteredProviders.length === 0 ? (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              {searchTerm ? "No providers found" : "No providers available"}
            </div>
          ) : (
            filteredProviders.map((provider) => {
              const isSelected = provider.enabled;

              return (
                <button
                  key={provider.provider_id}
                  type="button"
                  onClick={() => {
                    if (isReadonly) return;
                    onProviderClick(provider.provider_id);
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
                        {provider.provider_name}
                      </div>
                      {provider.provider_description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {provider.provider_description}
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

