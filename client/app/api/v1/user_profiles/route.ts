import { handle } from "@/lib/api/route-factory";
import { userProfileRepo, UserProfileCreateSchema } from "@/lib/repos/userProfileRepo";
import type { UserProfileCreate } from "@/lib/repos/userProfileRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => userProfileRepo.list(),
    (e: unknown) =>
      log.error("api.user_profiles.list.failed", {
        message: "Failed to list user_profiles",
        subject: { entityType: "user_profiles" },
        error: e,
      })
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = UserProfileCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as UserProfileCreate;
  return handle(
    () => userProfileRepo.create(payload),
    (e: unknown) =>
      log.error("api.user_profiles.create.failed", {
        message: "Failed to create userProfile",
        subject: { entityType: "user_profiles" },
        context: { body: json },
        error: e,
      })
  );
}
