import { handle } from "@/lib/api/route-factory";
import { profileRepo, ProfileUpdateSchema } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z
    .array(
      z
        .object({
          id: z.string().min(1),
        })
        .merge(ProfileUpdateSchema)
    )
    .min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => profileRepo.updateMany(parsed.data.updates),
    (e: unknown) =>
      log.error("api.profiles.bulk_update.failed", {
        message: "Failed to update profiles in bulk",
        subject: { entityType: "profiles" },
        context: { count: parsed.data.updates.length },
        error: e,
      })
  );
}
