import { handle } from "@/lib/api/route-factory";
import {
  parameterItemRepo,
  ParameterItemUpdateSchema,
  type ParameterItemUpdate,
} from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z.array(ParameterItemUpdateSchema).min(1),
});

export async function PATCH(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkUpdateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updates = parsed.data.updates as Array<
    { id: string } & ParameterItemUpdate
  >;

  return handle(
    () => parameterItemRepo.updateMany(updates),
    (e: unknown) =>
      log.error("api.parameter_items.bulk_update.failed", {
        message: "Failed to update parameter items in bulk",
        subject: { entityType: "parameter_items" },
        context: { count: updates.length },
        error: e,
      })
  );
}
