import { handle } from "@/lib/api/route-factory";
import type { DepartmentUpdate } from "@/lib/repos/departmentRepo";
import {
  departmentRepo,
  DepartmentUpdateSchema,
} from "@/lib/repos/departmentRepo";
import { log } from "@/utils/logger";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handle(
    () => departmentRepo.find(id),
    (e: unknown) =>
      log.error("api.departments.get.failed", {
        message: "Failed to fetch department",
        subject: { entityType: "departments", entityId: String(id) },
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
  const parsed = DepartmentUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.message }, { status: 400 });
  }
  const patch = parsed.data as unknown as DepartmentUpdate;
  return handle(
    () => departmentRepo.update(id, patch),
    (e: unknown) =>
      log.error("api.departments.patch.failed", {
        message: "Failed to update department",
        subject: { entityType: "departments", entityId: String(id) },
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
      await departmentRepo.remove(id);
      return {};
    },
    (e: unknown) =>
      log.error("api.departments.delete.failed", {
        message: "Failed to delete department",
        subject: { entityType: "departments", entityId: String(id) },
        error: e,
      }),
  );
}
