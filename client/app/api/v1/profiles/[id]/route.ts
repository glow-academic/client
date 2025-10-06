import { handle } from "@/lib/api/route-factory";
import { profileRepo, ProfileUpdateSchema } from "@/lib/repos/profileRepo";
import type { ProfileUpdate } from "@/lib/repos/profileRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => profileRepo.find(id),
    (e: unknown) =>
      log.error("api.profiles.get.failed", {
        message: "Failed to fetch profile",
        subject: { entityType: "profiles", entityId: String(id) },
        error: e,
      }),
  );
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = ProfileUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const patch = parsed.data as unknown as ProfileUpdate;
  return handle(
    () => profileRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.profiles.patch.failed", {
        message: "Failed to update profile",
        subject: { entityType: "profiles", entityId: String(id) },
        context: { body: json },
        error: e,
      }),
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    async () => {
      await profileRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.profiles.delete.failed", {
        message: "Failed to delete profile",
        subject: { entityType: "profiles", entityId: String(id) },
        error: e,
      }),
  );
}
