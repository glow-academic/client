import { handle } from "@/lib/api/route-factory";
import { documentRepo } from "@/lib/repos/documentRepo";
import { log } from "@/utils/logger";
import { z } from "zod";

const BulkUpdateBody = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z
          .enum([
            "homework",
            "project",
            "quiz",
            "midterm",
            "lab",
            "lecture",
            "syllabus",
          ])
          .optional(),
        tags: z.array(z.string()).optional(),
        updatedAt: z.string().optional(),
        active: z.boolean().optional(),
        classified: z.boolean().optional(),
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
    () => documentRepo.updateMany(parsed.data.updates),
    (e: unknown) =>
      log.error("api.documents.bulk_update.failed", {
        message: "Failed to update documents in bulk",
        subject: { entityType: "documents" },
        context: { count: parsed.data.updates.length },
        error: e,
      })
  );
}
