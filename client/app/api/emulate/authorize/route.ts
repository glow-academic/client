import { auth } from "@/auth";
import { canEmulate } from "@/utils/auth/can-emulate";
import { getProfile } from "@/utils/queries/profiles/get-profile";
import { log } from "@/utils/server-logger";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { targetProfileId } = await req.json().catch(() => ({}));
  if (!targetProfileId) {
    return NextResponse.json(
      { error: "Missing targetProfileId" },
      { status: 400 }
    );
  }

  const target = await getProfile(targetProfileId);
  if (!target)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const allowed = await canEmulate({
    requesterRole: session.user.role!,
    targetProfileId,
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
