import { handle } from "@/lib/api/route-factory";
import {
  profileDepartmentRepo,
  ProfileDepartmentCreateSchema,
} from "@/lib/repos/profileDepartmentRepo";
import type { ProfileDepartmentCreate } from "@/lib/repos/profileDepartmentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => profileDepartmentRepo.list(),
    (e: unknown) =>
      log.error("api.profile_departments.list.failed", {
        message: "Failed to list profile_departments",
        subject: { entityType: "profile_departments" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = ProfileDepartmentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as ProfileDepartmentCreate;
  return handle(
    () => profileDepartmentRepo.create(payload),
    (e: unknown) =>
      log.error("api.profile_departments.create.failed", {
        message: "Failed to create profileDepartment",
        subject: { entityType: "profile_departments" },
        context: { body: json },
        error: e,
      }),
  );
}
