import { handle } from "@/lib/api/route-factory";
import {
  profileRepo,
  ProfileUpdateSchema,
  type ProfileUpdate,
} from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z.array(ProfileUpdateSchema).min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data.updates as Array<{ id: string } & ProfileUpdate>;

  return handle(
    () => profileRepo.updateMany(updates),
    (e: unknown) =>
      log.error("api.profiles.bulk_update.failed", {
        message: "Failed to update profiles in bulk",
        subject: { entityType: "profiles" },
        context: { count: updates.length },
        error: e,
      }),
  );
}
