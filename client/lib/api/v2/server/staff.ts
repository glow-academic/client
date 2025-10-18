/**
 * Server-side fetcher functions for staff v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { ProfileDetailResponseSchema } from "../schemas/profile";

export const fetchStaffDetail = cache(
  async (profileId: string, currentProfileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/staff/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileId, currentProfileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch staff detail");
    }

    const data = await res.json();
    return ProfileDetailResponseSchema.parse(data);
  }
);

export const fetchStaffDetailBulk = cache(
  async (profileIds: string[], currentProfileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/staff/detail-bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ profileIds, currentProfileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch bulk staff details");
    }

    const data = await res.json();
    return data;
  }
);
