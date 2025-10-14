/**
 * Server-side fetcher functions for departments v2 API
 * Memoized with React cache to prevent duplicate requests
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import { DepartmentDetailResponseSchema } from "../schemas/departments";

export const fetchDepartmentDetail = cache(
  async (departmentId: string, profileId: string) => {
    const res = await fetch(`${getApiBase()}/api/v2/departments/detail`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ departmentId, profileId }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch department detail");
    }

    const data = await res.json();
    return DepartmentDetailResponseSchema.parse(data);
  }
);

export const fetchDepartmentDetailDefault = cache(async (profileId: string) => {
  const res = await fetch(`${getApiBase()}/api/v2/departments/detail-default`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ profileId }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch default department detail");
  }

  const data = await res.json();
  return DepartmentDetailResponseSchema.parse(data);
});
