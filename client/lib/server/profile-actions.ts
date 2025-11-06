"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type AuthorizeEmulationIn = InputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;
type AuthorizeEmulationOut = OutputOf<
  "/api/v3/profile/authorize-emulation",
  "post"
>;

export async function authorizeEmulation(
  input: AuthorizeEmulationIn,
): Promise<AuthorizeEmulationOut> {
  return api.post("/profile/authorize-emulation", input);
}
