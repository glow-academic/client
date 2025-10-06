import { handle } from "@/lib/api/route-factory";
import type { ProfileCreate } from "@/lib/repos/profileRepo";
import { profileRepo } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const Body = z.object({
  profiles: z
    .array(
      z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        alias: z.string().min(1),
        role: z.enum([
          "superadmin",
          "admin",
          "instructional",
          "instructor",
          "ta",
          "guest",
        ]),
        userId: z.number().optional(),
        active: z.boolean().optional(),
        defaultProfile: z.boolean().optional(),
        viewedIntro: z.boolean().optional(),
        viewedChat: z.boolean().optional(),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => profileRepo.createMany(parsed.data.profiles as ProfileCreate[]),
    (e: unknown) =>
      log.error("api.profiles.bulk_create.failed", {
        message: "Failed to create profiles in bulk",
        subject: { entityType: "profiles" },
        context: { count: parsed.data.profiles.length },
        error: e,
      }),
  );
}
