"use server";

import { providers } from "@/utils/drizzle/schema";
import { logError } from "@/utils/logger";
import { encryptProviderKey } from "@/utils/model/server-model";
import { updateProvider } from "@/utils/mutations/providers/update-provider";

interface UpdateProviderData {
  name?: string;
  description?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function updateProviderWithEncryption(
  id: string,
  data: UpdateProviderData,
) {
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

    // Update the provider
    const result = await updateProvider(id, updateData);

    return result;
  } catch (error) {
    logError("Error updating provider with encryption:", error);
    throw error;
  }
}
