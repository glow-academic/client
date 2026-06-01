"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

export type CreateFeedbackIn = InputOf<"/system/problem", "post">;
export type CreateFeedbackOut = OutputOf<"/system/problem", "post">;

export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/system/problem", input);
}
