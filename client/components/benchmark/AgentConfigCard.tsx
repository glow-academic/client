/**
 * AgentConfigCard.tsx
 * Individual agent configuration card for benchmark attempts
 * Shows all configurable options: model, provider, endpoint, system prompt, API key, temperature, reasoning, voices
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import { ProviderCardGrid } from "@/components/common/models/ProviderCardGrid";
import { VoiceCardGrid } from "@/components/common/models/VoiceCardGrid";
import { AgentTemperatureSection } from "@/components/agents/AgentTemperatureSection";
import { AgentReasoningSection } from "@/components/agents/AgentReasoningSection";
import { AgentModelSection } from "@/components/agents/AgentModelSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMemo } from "react";
import type { OutputOf } from "@/lib/api/types";

type AgentDetailOut = OutputOf<"/api/v4/agents/detail", "post">;

export interface AgentConfigCardProps {
  agentId: string;
  agentName: string;
  agentDetail: AgentDetailOut | null; // Full agent detail with model_mapping
  agentConfig: {
    model_id: string | null;
    provider_id: string | null;
    base_url: string | null;
    system_prompt: string;
    temperature_level_id: string | null;
    reasoning_level_id: string | null;
    voice_ids: string[];
  };
  apiKey: string; // Runtime-only, not in draft
  onConfigChange: (updates: Partial<AgentConfigCardProps["agentConfig"]>) => void;
  onApiKeyChange: (apiKey: string) => void;
  isReadonly: boolean;
  providerMapping: Record<string, { name: string; description?: string }>;
  validProviderIds: string[];
}

export function AgentConfigCard({
  agentId,
  agentName,
  agentDetail,
  agentConfig,
  apiKey,
  onConfigChange,
  onApiKeyChange,
  isReadonly,
  providerMapping,
  validProviderIds,
}: AgentConfigCardProps) {
  // Build model mapping from agent detail
  const modelMapping = useMemo(() => {
    if (!agentDetail?.models) return {};
    const mapping: Record<string, { id: string; name: string; description?: string }> = {};
    agentDetail.models.forEach((model) => {
      if (model.model_id) {
        mapping[model.model_id] = {
          id: model.model_id,
          name: model.name || "",
          description: model.description || undefined,
        };
      }
    });
    return mapping;
  }, [agentDetail?.models]);

  const validModelIds = useMemo(() => {
    return agentDetail?.valid_model_ids || [];
  }, [agentDetail?.valid_model_ids]);

  // Get temperature bounds from selected model
  const temperatureBounds = useMemo(() => {
    if (!agentConfig.model_id || !agentDetail?.models) {
      return {
        lower: 0.0,
        upper: 1.0,
        values: [],
        levels: [],
      };
    }

    const selectedModel = agentDetail.models.find(
      (m) => m.model_id === agentConfig.model_id
    );
    if (!selectedModel) {
      return {
        lower: 0.0,
        upper: 1.0,
        values: [],
        levels: [],
      };
    }

    const lower = selectedModel.temperature_lower ?? 0.0;
    const upper = selectedModel.temperature_upper ?? 1.0;

    // Parse temperature levels from JSONB
    let levels: Array<{ id: string; temperature: string; is_upper: boolean }> = [];
    if (selectedModel.temperature_levels) {
      const tempLevels = selectedModel.temperature_levels;
      if (typeof tempLevels === "object") {
        const levelsArray = Array.isArray(tempLevels)
          ? tempLevels
          : Object.values(tempLevels);
        levels = levelsArray.map((l: any) => ({
          id: String(l.id || ""),
          temperature: String(l.temperature || ""),
          is_upper: Boolean(l.is_upper || false),
        }));
      }
    }

    const values = levels
      .filter((l) => !l.is_upper)
      .map((l) => l.temperature)
      .filter(Boolean);

    return {
      lower,
      upper,
      values,
      levels,
    };
  }, [agentConfig.model_id, agentDetail?.models]);

  // Get current temperature value from level_id
  const currentTemperature = useMemo(() => {
    if (!agentConfig.temperature_level_id || temperatureBounds.levels.length === 0) {
      return 0.7;
    }
    const level = temperatureBounds.levels.find(
      (l) => l.id === agentConfig.temperature_level_id && !l.is_upper
    );
    return level ? parseFloat(level.temperature) : 0.7;
  }, [agentConfig.temperature_level_id, temperatureBounds.levels]);

  // Get reasoning options from selected model
  const reasoningOptions = useMemo(() => {
    if (!agentConfig.model_id || !agentDetail?.models) {
      return [];
    }
    const selectedModel = agentDetail.models.find(
      (m) => m.model_id === agentConfig.model_id
    );
    if (!selectedModel?.reasoning_options) return [];

    const reasoningOpts = selectedModel.reasoning_options;
    if (typeof reasoningOpts === "object") {
      const optsArray = Array.isArray(reasoningOpts)
        ? reasoningOpts
        : Object.values(reasoningOpts);
      return optsArray.map((opt: any) => ({
        id: String(opt.id || ""),
        reasoning_level: String(opt.reasoning_level || ""),
      }));
    }
    return [];
  }, [agentConfig.model_id, agentDetail?.models]);

  // Build reasoning mapping
  const reasoningMapping = useMemo(() => {
    const mapping: Record<string, { id: string; name: string; description?: string }> = {};
    reasoningOptions.forEach((opt) => {
      if (opt.reasoning_level) {
        mapping[opt.reasoning_level] = {
          id: opt.id,
          name: opt.reasoning_level.charAt(0).toUpperCase() + opt.reasoning_level.slice(1),
          description: `Reasoning effort: ${opt.reasoning_level}`,
        };
      }
    });
    return mapping;
  }, [reasoningOptions]);

  // Get current reasoning level
  const currentReasoning = useMemo(() => {
    if (!agentConfig.reasoning_level_id) return "none";
    const option = reasoningOptions.find((opt) => opt.id === agentConfig.reasoning_level_id);
    return option?.reasoning_level || "none";
  }, [agentConfig.reasoning_level_id, reasoningOptions]);

  // Get available voices from selected model
  const availableVoices = useMemo(() => {
    if (!agentConfig.model_id || !agentDetail?.models) {
      return [];
    }
    const selectedModel = agentDetail.models.find(
      (m) => m.model_id === agentConfig.model_id
    );
    if (!selectedModel?.available_voices) return [];

    const voices = selectedModel.available_voices;
    if (typeof voices === "object") {
      const voicesArray = Array.isArray(voices) ? voices : Object.values(voices);
      return voicesArray.map((v: any) => ({
        id: String(v.id || ""),
        voice: String(v.voice || ""),
      }));
    }
    return [];
  }, [agentConfig.model_id, agentDetail?.models]);

  // Check if custom model (has base_url)
  const isCustomModel = Boolean(agentConfig.base_url && agentConfig.base_url.trim());

  // Helper to get temperature level ID from temperature value
  const getTemperatureLevelId = (temp: number): string | null => {
    const matchingLevel = temperatureBounds.levels.find(
      (l) => !l.is_upper && Math.abs(parseFloat(l.temperature) - temp) < 0.001
    );
    return matchingLevel?.id || null;
  };

  // Helper to get reasoning option ID from reasoning level
  const getReasoningOptionId = (reasoningLevel: string): string | null => {
    const option = reasoningOptions.find((opt) => opt.reasoning_level === reasoningLevel);
    return option?.id || null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{agentName}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Model Selection */}
        <div className="space-y-2">
          <Label>Model</Label>
          {validModelIds.length > 0 ? (
            <AgentModelSection
              modelId={agentConfig.model_id || ""}
              modelMapping={modelMapping}
              validModelIds={validModelIds}
              filteredValidModelIds={validModelIds}
              onModelChange={(modelId) => {
                onConfigChange({ model_id: modelId || null });
                // Reset temperature/reasoning/voices when model changes
                onConfigChange({
                  temperature_level_id: null,
                  reasoning_level_id: null,
                  voice_ids: [],
                });
              }}
              stepStatus="completed"
              stepTitle="Model"
              stepDescription="Select the model for this agent"
              stepNumber={1}
              isReadonly={isReadonly}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No models available. Please configure models first.
            </p>
          )}
        </div>

        {/* Provider Selection (only if custom model) */}
        {isCustomModel && (
          <div className="space-y-2">
            <Label>Provider</Label>
            <ProviderCardGrid
              providerMapping={providerMapping}
              validProviderIds={validProviderIds}
              selectedProviderId={agentConfig.provider_id}
              onSelect={(providerId) => onConfigChange({ provider_id: providerId })}
              readonly={isReadonly}
            />
          </div>
        )}

        {/* Base URL (only if custom model) */}
        {isCustomModel && (
          <div className="space-y-2">
            <Label htmlFor={`base-url-${agentId}`}>Base URL</Label>
            <Input
              id={`base-url-${agentId}`}
              value={agentConfig.base_url || ""}
              onChange={(e) => onConfigChange({ base_url: e.target.value || null })}
              placeholder="https://api.example.com/v1"
              disabled={isReadonly}
            />
          </div>
        )}

        {/* System Prompt */}
        <div className="space-y-2">
          <Label htmlFor={`system-prompt-${agentId}`}>System Prompt</Label>
          <Textarea
            id={`system-prompt-${agentId}`}
            value={agentConfig.system_prompt}
            onChange={(e) => onConfigChange({ system_prompt: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
            placeholder="System prompt for the agent..."
            disabled={isReadonly}
          />
        </div>

        {/* API Key (runtime-only, not saved in draft) */}
        <div className="space-y-2">
          <Label htmlFor={`api-key-${agentId}`}>API Key</Label>
          <Input
            id={`api-key-${agentId}`}
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Enter API key (not saved)"
            disabled={isReadonly}
          />
          <p className="text-xs text-muted-foreground">
            API key is stored in memory only and will be cleared on page refresh.
          </p>
        </div>

        {/* Temperature (only if model has temperature levels) */}
        {temperatureBounds.levels.length > 0 && (
          <div className="space-y-2">
            <AgentTemperatureSection
              temperature={currentTemperature}
              temperatureBounds={temperatureBounds}
              model_temperature_level_id={agentConfig.temperature_level_id}
              onTemperatureChange={(temp) => {
                const levelId = getTemperatureLevelId(temp);
                onConfigChange({ temperature_level_id: levelId });
              }}
              onTemperatureLevelIdChange={(levelId) => {
                onConfigChange({ temperature_level_id: levelId });
              }}
              stepStatus="completed"
              stepTitle="Temperature"
              stepDescription="Configure temperature setting"
              stepNumber={2}
              isReadonly={isReadonly}
            />
          </div>
        )}

        {/* Reasoning (only if model has reasoning options) */}
        {reasoningOptions.length > 0 && (
          <div className="space-y-2">
            <AgentReasoningSection
              model_reasoning_level_id={agentConfig.reasoning_level_id}
              reasoning={currentReasoning as "none" | "minimal" | "low" | "medium" | "high"}
              reasoningMapping={reasoningMapping}
              reasoningOptions={reasoningOptions}
              onReasoningChange={(reasoningLevel, optionId) => {
                onConfigChange({
                  reasoning_level_id: optionId,
                });
              }}
              stepStatus="completed"
              stepTitle="Reasoning Effort"
              stepDescription="Configure reasoning effort level"
              stepNumber={3}
              isReadonly={isReadonly}
            />
          </div>
        )}

        {/* Voices (only if model has voices) */}
        {availableVoices.length > 0 && (
          <div className="space-y-2">
            <Label>Voices</Label>
            <VoiceCardGrid
              selectedIds={agentConfig.voice_ids}
              onSelect={(ids) => onConfigChange({ voice_ids: ids })}
              readonly={isReadonly}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

