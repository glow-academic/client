import { handle } from "@/lib/api/route-factory";
import type { ProfileCreate } from "@/lib/repos/profileRepo";
import { ProfileCreateSchema, profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => profileRepo.list(),
    (e: unknown) =>
      log.error("api.profiles.list.failed", {
        message: "Failed to list profiles",
        subject: { entityType: "profiles" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ProfileCreate;
  return handle(
    () => profileRepo.create(payload),
    (e: unknown) =>
      log.error("api.profiles.create.failed", {
        message: "Failed to create profile",
        subject: { entityType: "profiles" },
        context: { body: json },
        error: e,
      }),
  );
}
