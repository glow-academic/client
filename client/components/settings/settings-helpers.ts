/**
 * Settings helper functions - conversion between arrays and dicts
 * API returns arrays (composite types), but frontend uses dicts internally
 */

import type { SettingsDetailOut } from "@/app/(main)/settings/page";

/**
 * Convert provider keys array to mapping dict
 */
export function convertProviderKeysToMapping(
  providerKeys: SettingsDetailOut["provider_keys"] | undefined
): Record<string, string> {
  if (!providerKeys) return {};
  const mapping: Record<string, string> = {};
  providerKeys.forEach((pk) => {
    if (pk.provider_id) {
      mapping[pk.provider_id] = pk.key_id || "";
    }
  });
  return mapping;
}

/**
 * Convert auth keys array to mapping dict
 */
export function convertAuthKeysToMapping(
  authKeys: SettingsDetailOut["auth_keys"] | undefined
): Record<string, Record<string, string>> {
  if (!authKeys) return {};
  const mapping: Record<string, Record<string, string>> = {};
  authKeys.forEach((ak) => {
    if (!ak.auth_id) return;
    const itemsMapping: Record<string, string> = {};
    (ak.items || []).forEach((item) => {
      if (item.auth_item_id) {
        itemsMapping[item.auth_item_id] = item.key_id || "";
      }
    });
    mapping[ak.auth_id] = itemsMapping;
  });
  return mapping;
}

/**
 * Convert auth values array to mapping dict
 */
export function convertAuthValuesToMapping(
  authValues: SettingsDetailOut["auth_values"] | undefined
): Record<string, Record<string, string>> {
  if (!authValues) return {};
  const mapping: Record<string, Record<string, string>> = {};
  authValues.forEach((av) => {
    if (!av.auth_id) return;
    const itemsMapping: Record<string, string> = {};
    (av.items || []).forEach((item) => {
      if (item.auth_item_id) {
        itemsMapping[item.auth_item_id] = item.value || "";
      }
    });
    mapping[av.auth_id] = itemsMapping;
  });
  return mapping;
}

/**
 * Convert provider keys mapping dict to array
 */
export function convertProviderKeysMappingToArray(
  mapping: Record<string, string>
): Array<{ provider_id: string; key_id: string }> {
  return Object.entries(mapping).map(([provider_id, key_id]) => ({
    provider_id,
    key_id,
  }));
}

/**
 * Convert auth keys mapping dict to array
 */
export function convertAuthKeysMappingToArray(
  mapping: Record<string, Record<string, string>>
): Array<{
  auth_id: string;
  items: Array<{ auth_item_id: string; key_id: string }>;
}> {
  return Object.entries(mapping).map(([auth_id, itemsMapping]) => ({
    auth_id,
    items: Object.entries(itemsMapping).map(([auth_item_id, key_id]) => ({
      auth_item_id,
      key_id,
    })),
  }));
}

/**
 * Convert provider enabled mapping dict to array
 */
export function convertProviderEnabledMappingToArray(
  mapping: Record<string, boolean>
): Array<{ provider_id: string; enabled: boolean }> {
  return Object.entries(mapping).map(([provider_id, enabled]) => ({
    provider_id,
    enabled,
  }));
}

/**
 * Convert auth enabled mapping dict to array
 */
export function convertAuthEnabledMappingToArray(
  mapping: Record<string, boolean>
): Array<{ auth_id: string; enabled: boolean }> {
  return Object.entries(mapping).map(([auth_id, enabled]) => ({
    auth_id,
    enabled,
  }));
}

/**
 * Convert auth values mapping dict to array
 */
export function convertAuthValuesMappingToArray(
  mapping: Record<string, Record<string, string>>
): Array<{
  auth_id: string;
  items: Array<{ auth_item_id: string; value: string }>;
}> {
  return Object.entries(mapping).map(([auth_id, itemsMapping]) => ({
    auth_id,
    items: Object.entries(itemsMapping).map(([auth_item_id, value]) => ({
      auth_item_id,
      value,
    })),
  }));
}

