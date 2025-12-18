/**
 * SettingsAIProviderConfigSection.tsx
 * Individual AI provider configuration section with step status
 * Uses card-based key selection
 */
"use client";
import { Check } from "lucide-react";

import { SettingsKeyPicker } from "@/components/settings/SettingsKeyPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ProviderTableItem {
  provider_id: string;
  provider_name: string;
  provider_description: string;
  provider_value: string | null;
  selected_key_id: string | null;
  enabled: boolean;
}

export interface SettingsAIProviderConfigSectionProps {
  providerId: string;
  providerName: string;
  providerDescription: string;
  data: ProviderTableItem[];
  keyMapping: Record<
    string,
    {
      name: string;
      description: string;
      key_masked: string;
      active: boolean;
      department_ids: string[] | null;
    }
  >;
  validKeyIds: string[];
  onKeyChange: (providerId: string, keyId: string | null) => void;
  stepStatus: "pending" | "active" | "completed";
  stepTitle: string;
  stepDescription: string;
  stepNumber: number;
  isReadonly: boolean;
}

export function SettingsAIProviderConfigSection({
  providerId,
  providerName,
  providerDescription,
  data,
  keyMapping,
  validKeyIds,
  onKeyChange,
  stepStatus,
  stepTitle,
  stepDescription,
  stepNumber,
  isReadonly,
}: SettingsAIProviderConfigSectionProps) {
  // Filter data to only show items for this provider
  const filteredData = data.filter((item) => item.provider_id === providerId);
  const provider = filteredData[0];
  const enabled = provider?.enabled ?? false;
  const selectedKeyId = provider?.selected_key_id ?? null;

  return (
    <Card
      className={cn(
        "transition-all",
        stepStatus === "active" && "ring-2 ring-primary",
        stepStatus === "pending" && "opacity-50",
      )}
    >
      <CardHeader className="flex flex-row items-center space-y-0 pb-4 justify-between">
        <div className="flex items-center space-x-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              stepStatus === "completed"
                ? "bg-green-500 text-white"
                : stepStatus === "active"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted",
            )}
          >
            {stepStatus === "completed" ? (
              <Check className="w-4 h-4" />
            ) : (
              String(stepNumber)
            )}
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{stepTitle}</CardTitle>
            <CardDescription>{stepDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!provider ? (
          <div className="text-center py-8 text-muted-foreground">
            No configuration available for this provider
          </div>
        ) : (
          <>
            {/* Key Selection */}
            <SettingsKeyPicker
              keyMapping={keyMapping}
              validKeyIds={validKeyIds}
              selectedKeyId={selectedKeyId}
              sectionLabel=""
              onKeyIdChange={(keyId) => onKeyChange(providerId, keyId)}
              isReadonly={isReadonly}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
