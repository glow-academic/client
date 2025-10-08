import { handle } from "@/lib/api/route-factory";
import { profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const Body = z.object({ ids: z.array(z.number()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => profileRepo.listByUsers(parsed.data.ids),
    (e: unknown) =>
      log.error("api.profiles.by.userId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "profiles" },
        context: { foreignKey: "userId", count: parsed.data.ids.length },
        error: e,
      })
  );
}
