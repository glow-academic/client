"use server";

import type { Provider } from "@/lib/repos/providerRepo";
import { providerRepo } from "@/lib/repos/providerRepo";
import { providers } from "@/utils/drizzle/schema";
import { log } from "@/utils/logger";
import { encryptProviderKey } from "@/utils/model/server-model";

interface UpdateProviderData {
  name?: string;
  description?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function updateProviderWithEncryption(
  id: string,
  data: UpdateProviderData,
): Promise<Provider> {
  try {
    // Prepare the update data
    const updateData: Partial<typeof providers.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };

    // Add fields that don't need encryption
    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    if (data.baseUrl !== undefined) {
      updateData.baseUrl = data.baseUrl;
    }

    // Encrypt API key if provided (ONLY ON SERVER SIDE)
    if (data.apiKey !== undefined && data.apiKey.trim() !== "") {
      updateData.apiKey = await encryptProviderKey(data.apiKey);
    }

    // Update the provider using the providerRepo directly
    const result = await providerRepo.update(id, updateData);

    return result;
  } catch (error) {
    log.error("provider.update.encryption_failed", {
      message: "Error updating provider with encryption",
      error,
      context: { function: "updateProviderWithEncryption", id },
    });
    throw error;
  }
}
