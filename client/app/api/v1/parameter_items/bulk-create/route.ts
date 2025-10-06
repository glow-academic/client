import { handle } from "@/lib/api/route-factory";
import {
  ParameterItemCreateSchema,
  parameterItemRepo,
} from "@/lib/repos/parameterItemRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkCreateBody = z.object({
  items: z.array(ParameterItemCreateSchema).min(1),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = BulkCreateBody.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return handle(
    () => parameterItemRepo.createMany(parsed.data.items),
    (e: unknown) =>
      log.error("api.parameter_items.bulk_create.failed", {
        message: "Failed to create parameter items in bulk",
        subject: { entityType: "parameter_items" },
        context: { count: parsed.data.items.length },
        error: e,
      }),
  );
}
