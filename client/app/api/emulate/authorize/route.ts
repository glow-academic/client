import { auth } from "@/auth";
import { profileRepo } from "@/lib/repos/profileRepo";
import { canEmulate } from "@/utils/auth/can-emulate";
import { log } from "@/utils/server-logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetProfileId, departmentIds } = await req.json().catch(() => ({}));
  if (!targetProfileId || !departmentIds) {
    return NextResponse.json(
      { error: "Missing targetProfileId or departmentIds" },
      { status: 400 },
    );
  }

  const target = await profileRepo.find(targetProfileId);
  if (!target)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const allowed = await canEmulate({
    requesterRole: session.user.role!,
    targetProfileId,
    departmentIds,
  });

  await log.info("auth.emulate.authorize", {
    message: allowed ? "Emulation authorized" : "Emulation denied",
    context: {
      requesterRole: session.user.role,
      targetProfileId,
    },
  });

  if (!allowed)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true });
}
