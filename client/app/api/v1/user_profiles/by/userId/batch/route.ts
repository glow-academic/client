import { handle } from "@/lib/api/route-factory";
import { userProfileRepo } from "@/lib/repos/userProfileRepo";
import { z } from "zod";
import { log } from "@/utils/logger";

const Body = z.object({ ids: z.array(z.number()).min(1) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  return handle(
    () => userProfileRepo.listByUsers(parsed.data.ids),
    (e: unknown) =>
      log.error("api.user_profiles.by.userId.batch.failed", {
        message: "Failed to fetch by foreign key batch",
        subject: { entityType: "user_profiles" },
        context: { foreignKey: "userId", count: parsed.data.ids.length },
        error: e,
      }),
  );
}
