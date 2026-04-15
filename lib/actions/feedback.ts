"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

export type CreateFeedbackIn = InputOf<"/api/v5/activity/problem", "post">;
export type CreateFeedbackOut = OutputOf<"/api/v5/activity/problem", "post">;

export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/system/activity/problem", input);
}
