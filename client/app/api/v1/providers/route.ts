import { handle } from "@/lib/api/route-factory";
import type { ProviderCreate } from "@/lib/repos/providerRepo";
import { ProviderCreateSchema, providerRepo } from "@/lib/repos/providerRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => providerRepo.list(),
    (e: unknown) =>
      log.error("api.providers.list.failed", {
        message: "Failed to list providers",
        subject: { entityType: "providers" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ProviderCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ProviderCreate;
  return handle(
    () => providerRepo.create(payload),
    (e: unknown) =>
      log.error("api.providers.create.failed", {
        message: "Failed to create provider",
        subject: { entityType: "providers" },
        context: { body: json },
        error: e,
      }),
  );
}
