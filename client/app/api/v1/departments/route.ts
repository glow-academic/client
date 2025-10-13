import { handle } from "@/lib/api/route-factory";
import type { DepartmentCreate } from "@/lib/repos/departmentRepo";
import {
  DepartmentCreateSchema,
  departmentRepo,
} from "@/lib/repos/departmentRepo";
import { log } from "@/utils/logger";

export async function GET() {
  return handle(
    () => departmentRepo.list(),
    (e: unknown) =>
      log.error("api.departments.list.failed", {
        message: "Failed to list departments",
        subject: { entityType: "departments" },
        error: e,
      }),
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => ({}));
  const parsed = DepartmentCreateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const payload = parsed.data as unknown as DepartmentCreate;
  return handle(
    () => departmentRepo.create(payload),
    (e: unknown) =>
      log.error("api.departments.create.failed", {
        message: "Failed to create department",
        subject: { entityType: "departments" },
        context: { body: json },
        error: e,
      }),
  );
}
