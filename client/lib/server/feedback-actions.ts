"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type CreateFeedbackIn = InputOf<"/api/v3/feedback/create", "post">;
type CreateFeedbackOut = OutputOf<"/api/v3/feedback/create", "post">;

export async function createFeedback(
  input: CreateFeedbackIn
): Promise<CreateFeedbackOut> {
  return api.post("/feedback/create", input);
}
