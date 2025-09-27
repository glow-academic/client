import { handle } from "@/lib/api/route-factory";
import { parameterItemRepo } from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().optional(),
        description: z.string().optional(),
        value: z.string().optional(),
        defaultItem: z.boolean().optional(),
        updatedAt: z.string().optional(),
      })
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
    () => parameterItemRepo.updateMany(parsed.data.updates),
    (e: unknown) =>
      log.error("api.parameter_items.bulk_update.failed", {
        message: "Failed to update parameter items in bulk",
        subject: { entityType: "parameter_items" },
        context: { count: parsed.data.updates.length },
        error: e,
      })
  );
}
